import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { AI_API_KEY, AI_CHAT_URL, MODEL_FAST } from '@/lib/ai';
import { extractJsonPayload } from '@/lib/ai-json';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const ingredientLines: unknown[] = Array.isArray(body.freshIngredients)
      ? body.freshIngredients
      : [];
    const ingredients = ingredientLines
      .filter((item): item is string => typeof item === 'string')
      .join('\n');
    const servings = Math.max(1, Number.parseInt(String(body.servings ?? '1'), 10) || 1);
    if (!title || !ingredients) return NextResponse.json({ error: 'A recipe is required' }, { status: 400 });

    const response = await fetch(AI_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_API_KEY}` },
      body: JSON.stringify({
        model: MODEL_FAST,
        messages: [{
          role: 'user',
          content: `Estimate average US grocery costs for this recipe. Return only JSON: {"estimatedCostPerServing": number, "storeBoughtCost": number}. Both values are dollars per serving, rounded to two decimals.\n\nRecipe: ${title}\nServings: ${servings}\nIngredients:\n${ingredients}`,
        }],
        temperature: 0.2,
        max_tokens: 160,
        response_format: { type: 'json_object' },
      }),
    });
    if (!response.ok) throw new Error(`AI request failed: ${response.status}`);
    const data = await response.json();
    const parsed = JSON.parse(extractJsonPayload(data.choices?.[0]?.message?.content || '{}'));
    const cost = (value: unknown) => {
      const parsedValue = Number(value);
      return Number.isFinite(parsedValue) && parsedValue >= 0 ? Math.round(parsedValue * 100) / 100 : null;
    };
    return NextResponse.json({
      estimatedCostPerServing: cost(parsed.estimatedCostPerServing),
      storeBoughtCost: cost(parsed.storeBoughtCost),
    });
  } catch (error) {
    console.error('Recipe cost estimate failed:', error);
    return NextResponse.json({ error: 'Failed to estimate recipe cost' }, { status: 500 });
  }
}
