import { NextResponse } from 'next/server';
import { getRequestUserId } from '@/lib/request-auth';
import { rateLimit } from '@/lib/rate-limit';
import { AI_API_KEY, AI_CHAT_URL, MODEL_FAST } from '@/lib/ai';
import { extractJsonPayload } from '@/lib/ai-json';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const nutrientKeys = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sodium'] as const;
const nutrient = z.number().finite().nonnegative().nullable();
const nutritionSchema = z.object({
  calories: nutrient, protein: nutrient, carbs: nutrient,
  fat: nutrient, fiber: nutrient, sodium: nutrient,
}).strict().refine((values) => Object.values(values).some((value) => value !== null),
  'Nutrition estimate must contain at least one usable value');
const nutritionJsonSchema = {
  type: 'object',
  properties: Object.fromEntries(nutrientKeys.map((key) => [key, { type: ['number', 'null'], minimum: 0 }])),
  required: [...nutrientKeys],
  additionalProperties: false,
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
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model: MODEL_FAST,
        messages: [
          {
            role: 'system',
            content: 'You estimate nutrition for recipes. Return only valid JSON without markdown or explanation.',
          },
          {
            role: 'user',
            content: `Estimate nutrition per serving for this recipe. Values are estimates, not medical advice.\n\nRecipe: ${title}\nServings: ${servings}\n\nIngredients:\n${freshIngredients}\n\nInstructions:\n${instructions}\n\nReturn exactly one flat JSON object with these six required keys: {"calories": number_or_null, "protein": number_or_null, "carbs": number_or_null, "fat": number_or_null, "fiber": number_or_null, "sodium": number_or_null}. Calories are kcal, protein/carbs/fat/fiber are grams, and sodium is milligrams. All numbers describe ONE serving. Use nonnegative numbers without units or text, including 0 when appropriate. Use null only for a nutrient that cannot be reasonably estimated. Do not wrap this object in nutrition, nutrients, perServing, or any other property. Do not return arrays, descriptions, ranges, or explanatory text.`,
          },
        ],
        temperature: 0.2,
        max_tokens: 1000,
        reasoning_effort: 'none',
        response_format: { type: 'json_schema', json_schema: { name: 'recipe_nutrition_estimate', strict: true, schema: nutritionJsonSchema } },
      }),
    });

    if (!response.ok) throw new Error(`AI request failed: ${response.status}`);
    const data = await response.json();
    const choice = data?.choices?.[0];
    if (choice?.finish_reason !== 'stop') throw new Error('Nutrition provider did not complete its response');
    const content = choice?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new Error('Nutrition provider returned no content');
    const parsed = nutritionSchema.parse(JSON.parse(extractJsonPayload(content)));
    const rounded = (value: number | null, precision = 1) => value === null ? null : Math.round(value * precision) / precision;

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
    // Do not log provider content: it can include the user's recipe text.
    console.error('Automatic nutrition estimate failed:', error instanceof Error ? error.name : 'Unknown error');
    return NextResponse.json({ error: 'Nutrition is temporarily unavailable. Please try again.' }, { status: 503 });
  }
}
