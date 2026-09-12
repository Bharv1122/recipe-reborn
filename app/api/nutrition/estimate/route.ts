import { NextResponse } from 'next/server';
import { getRequestUserId } from '@/lib/request-auth';
import { rateLimit } from '@/lib/rate-limit';
import { nullableNutritionNumber } from '@/lib/nutrition-facts';
import { AI_API_KEY, AI_CHAT_URL, MODEL_FAST } from '@/lib/ai';
import { extractJsonPayload } from '@/lib/ai-json';

export const dynamic = 'force-dynamic';

type NutritionEstimate = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
};

function asRecipeText(value: unknown) {
  return Array.isArray(value) ? value.filter((line): line is string => typeof line === 'string').join('\n') : '';
}

// A stateless estimate lets generated recipes show nutrition immediately,
// without silently saving a recipe to the user's collection first.
export async function POST(request: Request) {
  try {
    const userId = await getRequestUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = await rateLimit(`nutrition-estimate:${userId}`, 10, 60);
    if (!limited.success) return NextResponse.json({ error: 'Please try nutrition again in a minute.' }, { status: 429 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'A complete recipe is required for nutrition' }, { status: 400 });
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const freshIngredients = asRecipeText(body.freshIngredients);
    const instructions = asRecipeText(body.instructions);
    const servings = Math.max(1, Number.parseInt(String(body.servings ?? '1'), 10) || 1);

    if (!title || !freshIngredients || !instructions) {
      return NextResponse.json({ error: 'A complete recipe is required for nutrition' }, { status: 400 });
    }
    if (title.length > 200 || freshIngredients.length > 75000 || instructions.length > 300000 || servings > 1000) {
      return NextResponse.json({ error: 'Recipe is too large to estimate.' }, { status: 400 });
    }

    const response = await fetch(AI_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_API_KEY}` },
      body: JSON.stringify({
        model: MODEL_FAST,
        messages: [
          {
            role: 'system',
            content: 'You estimate nutrition for recipes. Return only valid JSON without markdown or explanation.',
          },
          {
            role: 'user',
            content: `Estimate nutrition per serving for this recipe. Values are estimates, not medical advice.\n\nRecipe: ${title}\nServings: ${servings}\n\nIngredients:\n${freshIngredients}\n\nInstructions:\n${instructions}\n\nReturn JSON with calories (kcal), protein (g), carbs (g), fat (g), fiber (g), and sodium (mg).`,
          },
        ],
        temperature: 0.2,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) throw new Error(`AI request failed: ${response.status}`);
    const data = await response.json();
    const parsed = JSON.parse(extractJsonPayload(data.choices?.[0]?.message?.content || '')) as Partial<NutritionEstimate>;
    const rounded = (value: unknown, precision = 1) => {
      const number = nullableNutritionNumber(value);
      return number === null ? null : Math.round(number * precision) / precision;
    };

    return NextResponse.json({
      calories: rounded(parsed.calories),
      protein: rounded(parsed.protein, 10),
      carbs: rounded(parsed.carbs, 10),
      fat: rounded(parsed.fat, 10),
      fiber: rounded(parsed.fiber, 10),
      sodium: rounded(parsed.sodium),
      perServing: true,
      accuracy: 'estimated',
      basisLabel: `Per recipe serving (recipe makes ${servings})`,
      sourceLabel: 'Estimated from the generated recipe',
    });
  } catch (error) {
    console.error('Automatic nutrition estimate failed:', error);
    return NextResponse.json({ error: 'Failed to calculate nutrition' }, { status: 500 });
  }
}
