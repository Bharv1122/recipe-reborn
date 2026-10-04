import { NextResponse } from 'next/server';
import { MODEL_SMART } from '@/lib/ai';
import { recipeChat, hasRecipeAIKey, BackupInputError, BackupTransportError, ProviderConnectionError } from '@/lib/ai-provider';
import { getClientIp } from '@/lib/rate-limit';
import { checkGuestLimit } from '@/lib/guest-rate-limit';
import { extractJsonPayload } from '@/lib/ai-json';

/**
 * Reads the ingredient list off a label photo for anonymous visitors.
 *
 * The homepage promises "snap a photo of any ingredient label", but the only
 * guest entry point was a textarea — which on a phone, in a grocery aisle,
 * means typing a label by hand. This closes that gap.
 *
 * Unauthenticated and backed by the paid vision API, so it fails CLOSED and
 * draws on its own per-IP budget (a photo shouldn't cost a generation credit
 * before the visitor has seen anything).
 */

// The client downscales to ~1600px before upload, which lands well under 1MB.
// This is the backstop against someone POSTing a 50MB file straight at us.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export async function POST(req: Request) {
  try {
    // Validate the upload BEFORE touching the guest budget. The quota exists to
    // protect the paid vision call, so a visitor who picks the wrong file by
    // mistake shouldn't lose one of their three free scans over it.
    const formData = await req.formData().catch(() => null);
    const imageFile = formData?.get('image');

    if (!imageFile || typeof imageFile === 'string') {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    if (imageFile.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: 'That photo is too large. Try again — the app shrinks photos before sending.' },
        { status: 413 }
      );
    }

    const mimeType = imageFile.type || 'image/jpeg';
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: 'That file type is not supported. Use a photo from your camera.' },
        { status: 415 }
      );
    }

    if (!hasRecipeAIKey()) {
      return NextResponse.json({ error: 'AI API configuration missing' }, { status: 500 });
    }

    // The upload is real — now spend a scan.
    const ip = getClientIp(req);
    const limit = await checkGuestLimit(ip, 'ocr');

    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: 'limit',
          message:
            limit.reason === 'global'
              ? "We're at capacity for free label scans today. Sign up free to keep going."
              : "You've used your free label scans for today. Sign up free to keep scanning — no card needed.",
        },
        { status: 429 }
      );
    }

    const bytes = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(bytes).toString('base64');

    const prompt = `You are reading a photo of a packaged food product.

Find the INGREDIENTS list on the label and transcribe it.

Return ONLY a valid JSON object:
{
  "found": true or false,
  "productName": "the product name if visible, otherwise null",
  "ingredients": "the full ingredient list as a single comma-separated string"
}

RULES:
- Transcribe every ingredient you can read, including preservatives, colors, and additives — the fine print matters most here.
- Keep the label's original order.
- Drop the leading "INGREDIENTS:" heading and any trailing allergen or nutrition text.
- If there is no readable ingredient list in the image, set "found" to false and "ingredients" to "".
- Return ONLY the JSON, no other text.`;

    const response = await recipeChat({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: req.signal,
      body: JSON.stringify({
        model: MODEL_SMART,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${base64Image}`, detail: 'high' },
              },
            ],
          },
        ],
        // Matches extract-recipe-from-photo: long labels plus gemini-2.5-flash
        // thinking tokens share this budget, and 2000 truncated real labels.
        max_tokens: 8000,
        temperature: 0.1,
      }),
    }, { totalMs: 45_000 });

    if (!response.ok) {
      // Status only: provider bodies are never logged.
      console.error('[guest-extract-label] AI error:', response.status);
      await response.body?.cancel();
      return NextResponse.json(
        { error: "We couldn't read that photo. Try again, or type the ingredients instead." },
        { status: 502 }
      );
    }

    const data = await response.json();
    const choice = data?.choices?.[0];
    const content = choice?.message?.content;

    // Refused, truncated or otherwise unfinished answers are never accepted.
    if (choice?.finish_reason !== 'stop' || choice?.message?.refusal || typeof content !== 'string' || !content) {
      return NextResponse.json(
        { error: "We couldn't read that photo. Try again, or type the ingredients instead." },
        { status: 502 }
      );
    }

    let parsed: { found?: boolean; productName?: string | null; ingredients?: string };
    try {
      parsed = JSON.parse(extractJsonPayload(content));
    } catch {
      console.error('[guest-extract-label] Unparseable AI response', { length: content.length });
      return NextResponse.json(
        { error: "We couldn't read that photo. Try again, or type the ingredients instead." },
        { status: 502 }
      );
    }

    const ingredients = typeof parsed.ingredients === 'string' ? parsed.ingredients.trim() : '';

    if (!parsed.found || !ingredients) {
      return NextResponse.json(
        {
          error: 'no_label',
          message:
            "We couldn't find an ingredient list in that photo. Try getting closer to the label, or type the ingredients instead.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      ingredients,
      productName: typeof parsed.productName === 'string' ? parsed.productName : null,
      remaining: limit.remaining,
    });
  } catch (error) {
    if (error instanceof BackupInputError) {
      return NextResponse.json(
        { error: "This photo format isn't supported right now. Please use a JPEG, PNG or WebP photo." },
        { status: 415 }
      );
    }
    if (req.signal.aborted) return new NextResponse(null, { status: 499 });
    if (error instanceof BackupTransportError || error instanceof ProviderConnectionError || (error as { name?: string })?.name === 'TimeoutError') {
      // Not the photo's fault: say so instead of asking for a new photo.
      return NextResponse.json(
        { error: 'Label reading is temporarily unavailable. Try again in a minute, or type the ingredients instead.' },
        { status: 503 }
      );
    }
    console.error('[guest-extract-label] Unexpected error:', error instanceof Error ? error.name : 'Unknown error');
    return NextResponse.json(
      { error: 'Something went wrong reading that photo. Please try again.' },
      { status: 500 }
    );
  }
}
