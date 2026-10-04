import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { MODEL_FAST } from '@/lib/ai';
import { recipeChat, hasRecipeAIKey, canRetryRecipeAI } from '@/lib/ai-provider';
import { extractJsonPayload } from '@/lib/ai-json';
import { limitAiRequest } from '@/lib/ai-rate-limit';
import { withRequestDeadline } from '@/lib/request-deadline';

export const dynamic = 'force-dynamic';

// POST /api/ingredient-info - Get detailed ingredient information
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const aiLimited = await limitAiRequest(session.user.id);
    if (aiLimited) return aiLimited;

    const body = await req.json();
    const { ingredient } = body;

    if (!ingredient || typeof ingredient !== 'string') {
      return NextResponse.json(
        { error: 'Ingredient name is required' },
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

    // Parse the JSON response
    let ingredientInfo;
    try {
      ingredientInfo = JSON.parse(extractJsonPayload(content));
    } catch {
      // Parser messages can quote model output, so log only the event.
      console.error('Failed to parse ingredient info JSON');
      // Return a default response if parsing fails
      ingredientInfo = {
        name: ingredient,
        category: 'Unknown',
        nutrition: {
          calories: 'Not available',
          protein: 'Not available',
          carbs: 'Not available',
          fat: 'Not available',
          fiber: 'Not available',
          vitamins: []
        },
        healthBenefits: ['Nutritional information currently unavailable'],
        substitutions: [],
        allergens: [],
        seasonality: 'Varies by region',
        storageType: 'Store in a cool, dry place',
        shelfLife: 'Varies'
      };
    }

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
