import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequestUserId } from '@/lib/request-auth';
import { MODEL_FAST } from '@/lib/ai';
import { recipeChat, hasRecipeAIKey, canRetryRecipeAI } from '@/lib/ai-provider';
import { extractJsonPayload } from '@/lib/ai-json';
import { limitAiRequest } from '@/lib/ai-rate-limit';
import { withRequestDeadline } from '@/lib/request-deadline';

export const dynamic = 'force-dynamic';

const MAX_INGREDIENT_LENGTH = 200;

const text = (max: number) => z.string().trim().min(1).max(max);
// Models sometimes answer nutrition amounts as bare numbers; the UI shows text.
const amount = z.union([z.string(), z.number().finite()]).transform(String).pipe(text(80));
const list = (max: number) => z.array(text(300)).max(max);
const ingredientInfoSchema = z.object({
  name: text(120),
  category: text(80),
  nutrition: z.object({
    calories: amount,
    protein: amount,
    carbs: amount,
    fat: amount,
    fiber: amount,
    vitamins: list(12),
  }),
  healthBenefits: list(8),
  substitutions: z.array(z.object({
    ingredient: text(120),
    ratio: text(120),
    note: z.string().trim().max(600).default(''),
  })).max(8),
  allergens: list(12),
  seasonality: text(300),
  storageType: text(300),
  shelfLife: text(300),
});

// POST /api/ingredient-info - Get detailed ingredient information
export async function POST(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const aiLimited = await limitAiRequest(userId);
    if (aiLimited) return aiLimited;

    const body = await req.json().catch(() => null);
    const ingredient = typeof body?.ingredient === 'string' ? body.ingredient.trim() : '';

    if (!ingredient) {
      return NextResponse.json(
        { error: 'Ingredient name is required' },
        { status: 400 }
      );
    }
    if (ingredient.length > MAX_INGREDIENT_LENGTH) {
      return NextResponse.json(
        { error: 'Ingredient name is too long' },
        { status: 400 }
      );
    }

    if (!hasRecipeAIKey()) {
      return NextResponse.json(
        { error: 'AI API key not configured' },
        { status: 500 }
      );
    }

    // Create the prompt for ingredient information
    const prompt = `Provide detailed information about this ingredient: "${ingredient}"

Return the information in this exact JSON format:
{
  "name": "Proper ingredient name",
  "category": "Vegetable/Fruit/Protein/Grain/Dairy/etc.",
  "nutrition": {
    "calories": "Per 100g",
    "protein": "Amount",
    "carbs": "Amount",
    "fat": "Amount",
    "fiber": "Amount",
    "vitamins": ["Key vitamins"]
  },
  "healthBenefits": [
    "Benefit 1",
    "Benefit 2",
    "Benefit 3"
  ],
  "substitutions": [
    {
      "ingredient": "Substitute name",
      "ratio": "1:1 or other ratio",
      "note": "Any important notes"
    }
  ],
  "allergens": ["List of common allergens"],
  "seasonality": "When it's in season",
  "storageType": "How to store it",
  "shelfLife": "How long it lasts"
}

Provide accurate, concise information. Return ONLY valid JSON.`;

    const llmBody = JSON.stringify({
      model: MODEL_FAST,
      messages: [
        {
          role: 'system',
          content: 'You are a nutrition expert and culinary specialist. Provide detailed, accurate ingredient information in valid JSON format only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.5,
      // gemini-2.5-flash thinking tokens count against this budget
      max_tokens: 4000,
    });

    // One deadline covers the first attempt and its retry.
    const data = await withRequestDeadline(req.signal, 45_000, async (signal) => {
      const send = () => recipeChat({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: llmBody,
      }, { totalMs: 45_000 });

      let response = await send();
      // A failed backup answer is final; retrying would repeat the same paid call.
      if (canRetryRecipeAI(response) && [429, 500, 502, 503, 504].includes(response.status)) {
        console.error('Ingredient-info LLM non-OK:', response.status);
        await response.body?.cancel();
        signal.throwIfAborted();
        // Transient 429/5xx from the LLM API — one retry recovers most of them
        response = await send();
      }

      if (!response.ok) {
        throw new Error(`Failed to get ingredient information (${response.status})`);
      }
      return response.json();
    });
    const choice = data?.choices?.[0];
    const content = choice?.message?.content;

    // Refused, truncated or otherwise unfinished answers are never accepted.
    if (choice?.finish_reason !== 'stop' || choice?.message?.refusal || typeof content !== 'string' || !content) {
      throw new Error('No complete content in response');
    }

    // Malformed or incomplete output is an error, never placeholder facts.
    // The catch below logs only the error name, so model output is not leaked.
    const ingredientInfo = ingredientInfoSchema.parse(JSON.parse(extractJsonPayload(content)));

    return NextResponse.json(ingredientInfo);
  } catch (error) {
    if (req.signal.aborted) return new NextResponse(null, { status: 499 });
    console.error('Error getting ingredient info:', error instanceof Error ? error.name : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to get ingredient information' },
      { status: 500 }
    );
  }
}
