import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions } from '@/lib/auth-options';
import { MODEL_FAST } from '@/lib/ai';
import { recipeChat } from '@/lib/ai-provider';
import { limitAiRequest } from '@/lib/ai-rate-limit';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  ingredients: z.string().trim().min(3).max(5000),
});

const recommendationSchema = z.object({
  makeNow: z.object({
    title: z.string().trim().min(1).max(100),
    summary: z.string().trim().min(1).max(240),
  }),
  upgrade: z.object({
    title: z.string().trim().min(1).max(100),
    addIngredient: z.string().trim().min(1).max(80),
    summary: z.string().trim().min(1).max(240),
  }),
});

export type PantryRecommendation = z.infer<typeof recommendationSchema>;

function parseRecommendation(content: string) {
  const cleaned = content.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const objectStart = cleaned.indexOf('{');
  const objectEnd = cleaned.lastIndexOf('}');
  if (objectStart < 0 || objectEnd <= objectStart) return null;

  try {
    return recommendationSchema.parse(JSON.parse(cleaned.slice(objectStart, objectEnd + 1)));
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const aiLimited = await limitAiRequest(session.user.id);
    if (aiLimited) return aiLimited;

    const parsedRequest = requestSchema.safeParse(await request.json());
    if (!parsedRequest.success) {
      return NextResponse.json({ error: 'Pantry ingredients are required' }, { status: 400 });
    }

    const response = await recipeChat({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: request.signal,
      body: JSON.stringify({
        model: MODEL_FAST,
        temperature: 0.4,
        max_tokens: 500,
        messages: [
          {
            role: 'system',
            content: `You are Recipe Reborn's practical pantry assistant. Return only JSON with this exact shape:
{
  "makeNow": { "title": "...", "summary": "..." },
  "upgrade": { "title": "...", "addIngredient": "...", "summary": "..." }
}

Rules:
- makeNow must be a realistic dish using the listed ingredients plus only basic water, salt, or pepper.
- upgrade must build on the same ingredients and require exactly one additional grocery ingredient.
- Name that one grocery item in addIngredient.
- Keep each summary to one short sentence.
- Do not make health, nutrition, or cost claims.
- Do not invent ingredients in makeNow that the user did not list.`,
          },
          {
            role: 'user',
            content: `Ingredients on hand: ${parsedRequest.data.ingredients}`,
          },
        ],
      }),
    }, { totalMs: 30_000 });

    if (!response.ok) {
      console.error('Pantry recommendation model request failed:', response.status);
      return NextResponse.json({ error: 'Failed to create pantry ideas' }, { status: 502 });
    }

    const payload = await response.json();
    const choice = payload?.choices?.[0];
    const content = choice?.message?.content;
    // Refused, truncated or otherwise unfinished answers are never accepted.
    const finished = choice?.finish_reason === 'stop' && !choice?.message?.refusal;
    const recommendation = finished && typeof content === 'string' ? parseRecommendation(content) : null;
    if (!recommendation) {
      return NextResponse.json({ error: 'Pantry ideas were not returned in a usable format' }, { status: 502 });
    }

    return NextResponse.json(recommendation);
  } catch (error) {
    if (request.signal.aborted) return new NextResponse(null, { status: 499 });
    console.error('Pantry recommendation error:', error instanceof Error ? error.name : 'Unknown error');
    return NextResponse.json({ error: 'Failed to create pantry ideas' }, { status: 500 });
  }
}
