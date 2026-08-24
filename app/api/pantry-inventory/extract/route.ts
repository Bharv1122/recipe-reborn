import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AI_API_KEY, AI_CHAT_URL, MODEL_SMART } from '@/lib/ai';
import { extractJsonPayload } from '@/lib/ai-json';
import { normalizePantryItems, pantryInventoryItemSchema } from '@/lib/pantry-inventory';
import { rateLimit } from '@/lib/rate-limit';
import { getRequestUserId } from '@/lib/request-auth';

export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;
const MAX_IMAGES = 4;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

const extractionSchema = z.object({
  items: z.array(pantryInventoryItemSchema.extend({
    confidence: z.enum(['high', 'medium', 'low']).default('medium'),
  })).max(150),
  reviewNotes: z.array(z.string().trim().min(1).max(180)).max(10).default([]),
});

export async function POST(request: Request) {
  try {
    const userId = await getRequestUserId(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await rateLimit(`pantry-photo:${userId}`, 6, 60);
    if (!limited.success) {
      return NextResponse.json(
        { error: 'Too many photo scans. Please wait a minute and try again.' },
        { status: 429 },
      );
    }

    if (!AI_API_KEY) {
      return NextResponse.json({ error: 'Photo analysis is temporarily unavailable.' }, { status: 503 });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Upload photos using the photo picker.' }, { status: 400 });
    }
    const images = formData.getAll('images').filter((entry): entry is File => typeof entry !== 'string');
    const rawLocations = formData.getAll('locations').map(String);

    if (images.length < 1 || images.length > MAX_IMAGES) {
      return NextResponse.json({ error: `Add between 1 and ${MAX_IMAGES} photos.` }, { status: 400 });
    }

    const totalBytes = images.reduce((sum, image) => sum + image.size, 0);
    if (totalBytes > MAX_TOTAL_BYTES || images.some((image) => image.size > MAX_IMAGE_BYTES)) {
      return NextResponse.json({ error: 'Photos are too large. Use smaller images and try again.' }, { status: 413 });
    }
    if (images.some((image) => !ALLOWED_IMAGE_TYPES.has(image.type || 'image/jpeg'))) {
      return NextResponse.json({ error: 'Use JPEG, PNG, WebP, HEIC, or HEIF photos.' }, { status: 415 });
    }

    const prompt = `Identify visible food and cooking ingredients in these refrigerator and/or pantry photos.

Return only JSON with this shape:
{
  "items": [
    { "name": "plain ingredient name", "quantity": "visible approximate quantity or null", "location": "fridge|pantry|unknown", "confidence": "high|medium|low" }
  ],
  "reviewNotes": ["short note about an obscured or uncertain area"]
}

Rules:
- Include only food, beverages, condiments, spices, and cooking ingredients that are visibly present.
- Do not include shelves, containers, appliances, cleaning supplies, or non-food objects.
- Never guess a hidden label, brand, quantity, or ingredient. Use a generic visible name and null quantity when uncertain.
- Use the supplied location label for each photo unless the image clearly contradicts it.
- Combine all photos into one list and deduplicate the same item.
- Keep variants separate only when meaningfully different, such as red onions and green onions.
- This is a draft. The user will be required to correct it before saving.`;

    const content: Array<Record<string, unknown>> = [{ type: 'text', text: prompt }];
    for (let index = 0; index < images.length; index += 1) {
      const image = images[index];
      const location = rawLocations[index] === 'fridge' || rawLocations[index] === 'pantry'
        ? rawLocations[index]
        : 'unknown';
      const base64 = Buffer.from(await image.arrayBuffer()).toString('base64');
      content.push({ type: 'text', text: `Photo ${index + 1} location: ${location}` });
      content.push({
        type: 'image_url',
        image_url: { url: `data:${image.type || 'image/jpeg'};base64,${base64}`, detail: 'high' },
      });
    }

    const response = await fetch(AI_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_API_KEY}` },
      body: JSON.stringify({
        model: MODEL_SMART,
        temperature: 0.2,
        max_tokens: 5000,
        messages: [{ role: 'user', content }],
      }),
    });

    if (!response.ok) {
      console.error('Pantry photo model request failed:', response.status);
      return NextResponse.json({ error: 'Could not analyze those photos. Please try again.' }, { status: 502 });
    }

    const payload = await response.json();
    const modelContent = payload?.choices?.[0]?.message?.content;
    if (typeof modelContent !== 'string') {
      return NextResponse.json({ error: 'No inventory was returned from the photos.' }, { status: 502 });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonPayload(modelContent));
    } catch {
      return NextResponse.json({ error: 'The photo inventory could not be read. Try clearer photos.' }, { status: 502 });
    }

    const extraction = extractionSchema.safeParse(parsed);
    if (!extraction.success || extraction.data.items.length === 0) {
      return NextResponse.json({ error: 'No clear food items were found. Try a closer, well-lit photo.' }, { status: 422 });
    }

    const normalized = normalizePantryItems(extraction.data.items);
    const confidenceByName = new Map(
      extraction.data.items.map((item) => [item.name.trim().toLocaleLowerCase(), item.confidence]),
    );

    return NextResponse.json({
      items: normalized.map((item) => ({
        ...item,
        confidence: confidenceByName.get(item.name.toLocaleLowerCase()) ?? 'medium',
      })),
      reviewNotes: extraction.data.reviewNotes,
      requiresReview: true,
      photosStored: false,
    });
  } catch (error) {
    console.error('Pantry photo extraction error:', error);
    return NextResponse.json({ error: 'Failed to analyze pantry photos.' }, { status: 500 });
  }
}
