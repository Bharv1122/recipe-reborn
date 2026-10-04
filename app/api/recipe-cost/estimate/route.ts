import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { MODEL_FAST } from '@/lib/ai';
import { recipeChat } from '@/lib/ai-provider';
import { extractJsonPayload } from '@/lib/ai-json';
import { limitAiRequest } from '@/lib/ai-rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const aiLimited = await limitAiRequest(session.user.id);
    if (aiLimited) return aiLimited;

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

    const response = await recipeChat({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: request.signal,
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
    }, { totalMs: 30_000 });
    if (!response.ok) throw new Error(`AI request failed: ${response.status}`);
    const data = await response.json();
    const choice = data?.choices?.[0];
    const content = choice?.message?.content;
    // Refused, truncated or otherwise unfinished answers are never accepted.
    if (choice?.finish_reason !== 'stop' || choice?.message?.refusal || typeof content !== 'string' || !content.trim()) {
      throw new Error('Cost provider did not complete its response');
    }
    const parsed = JSON.parse(extractJsonPayload(content));
    const cost = (value: unknown) => {
      const parsedValue = Number(value);
      return Number.isFinite(parsedValue) && parsedValue >= 0 ? Math.round(parsedValue * 100) / 100 : null;
    };
    return NextResponse.json({
      estimatedCostPerServing: cost(parsed.estimatedCostPerServing),
      storeBoughtCost: cost(parsed.storeBoughtCost),
    });
  } catch (error) {
    if (request.signal.aborted) return new NextResponse(null, { status: 499 });
    // Raw errors can quote provider output; log only the error type.
    console.error('Recipe cost estimate failed:', error instanceof Error ? error.name : 'Unknown error');
    return NextResponse.json({ error: 'Failed to estimate recipe cost' }, { status: 500 });
  }
}
