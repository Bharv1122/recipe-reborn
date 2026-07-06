import { NextRequest, NextResponse } from 'next/server';
import { AI_CHAT_URL, AI_API_KEY, MODEL_SMART } from '@/lib/ai';
import { extractJsonPayload } from '@/lib/ai-json';
import { checkGuestLimit } from '@/lib/guest-rate-limit';
import { getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// Anonymous "try it free" recipe generation. No auth. Hard IP rate limit.
// Returns a full recipe; the client shows a teaser + signup wall.
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const limit = await checkGuestLimit(ip);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: 'Guest limit reached',
          message:
            "You've used your free previews for today. Sign up free to keep transforming — 3 recipes a month, no card needed.",
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawIngredients = typeof body.ingredients === 'string' ? body.ingredients.trim() : '';

    if (!rawIngredients) {
      return NextResponse.json({ error: 'Ingredients are required' }, { status: 400 });
    }
    // Cap prompt size — anonymous endpoint, don't let it be abused for long calls
    const ingredients = rawIngredients.slice(0, 2000);

    const prompt = `You are a professional chef helping users create fresh, healthy recipes from processed food ingredients.

The user has these processed food ingredients: ${ingredients}

Create a fresh, healthy recipe using whole, unprocessed ingredients that captures the essence of these processed foods. Provide clear, step-by-step instructions.

Provide a JSON response with this exact structure:
{
  "title": "Recipe name",
  "freshIngredients": ["ingredient 1 with quantity", "ingredient 2 with quantity"],
  "instructions": ["Step 1 description", "Step 2 description"],
  "prepTime": "15 minutes",
  "cookTime": "30 minutes",
  "servings": "4",
  "estimatedCostPerServing": 2.50,
  "storeBoughtCost": 6.75
}

For the cost fields, estimate using average US grocery prices: "estimatedCostPerServing" is the cost in USD to make one serving from the fresh ingredients, and "storeBoughtCost" is the cost in USD of one serving of the equivalent store-bought/packaged product. Both must be plain numbers (not strings), rounded to 2 decimal places.

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`;

    const llmRequest = {
      method: 'POST' as const,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL_SMART,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 6000,
        response_format: { type: 'json_object' },
      }),
    };

    let response = await fetch(AI_CHAT_URL, llmRequest);
    if (!response.ok) {
      response = await fetch(AI_CHAT_URL, llmRequest); // one retry on transient failure
    }
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('Guest generation LLM failed:', response.status, errText.slice(0, 300));
      throw new Error('AI request failed');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '';

    let recipe;
    try {
      recipe = JSON.parse(extractJsonPayload(content));
    } catch (parseError) {
      console.error('Guest generation parse failed:', content?.slice?.(0, 300));
      throw new Error('Could not build a recipe from that — try a fuller ingredient list.');
    }

    return NextResponse.json({ recipe, remaining: limit.remaining });
  } catch (error: any) {
    console.error('Guest generate error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate recipe' },
      { status: 500 }
    );
  }
}
