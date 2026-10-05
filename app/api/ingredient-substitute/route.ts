import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequestUserId } from '@/lib/request-auth';
import { prisma } from '@/lib/db';
import { MODEL_FAST } from '@/lib/ai';
import { recipeChat, hasRecipeAIKey } from '@/lib/ai-provider';
import { extractJsonPayload } from '@/lib/ai-json';
import { limitAiRequest } from '@/lib/ai-rate-limit';
import { findBlockedFood } from '@/lib/food-preferences';

export const dynamic = 'force-dynamic';

const MAX_INGREDIENT_LENGTH = 200;

const text = (max: number) => z.string().trim().min(1).max(max);
const substitutesSchema = z.object({
  substitutes: z.array(z.object({
    name: text(120),
    ratio: text(120),
    notes: z.string().trim().max(600).default(''),
  })).min(1).max(8),
});

// POST /api/ingredient-substitute - Suggest swaps that respect the user's saved allergies and dislikes
export async function POST(req: Request) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const aiLimited = await limitAiRequest(userId);
    if (aiLimited) return aiLimited;

    const body = await req.json().catch(() => null);
    const ingredient = typeof body?.ingredient === 'string' ? body.ingredient.trim() : '';
    if (!ingredient) {
      return NextResponse.json({ error: 'Ingredient is required' }, { status: 400 });
    }
    if (ingredient.length > MAX_INGREDIENT_LENGTH) {
      return NextResponse.json({ error: 'Ingredient is too long' }, { status: 400 });
    }

    // Preferences come from the saved profile only, never from the request body.
    const profile = await prisma.user.findUnique({
      where: { id: userId },
      select: { allergies: true, dislikedIngredients: true },
    });
    if (!profile) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    if (!hasRecipeAIKey()) {
      return NextResponse.json({ error: 'AI API key not configured' }, { status: 500 });
    }

    const avoid = [...profile.allergies, ...profile.dislikedIngredients];
    const avoidLine = avoid.length
      ? `\nNever suggest anything containing: ${avoid.join(', ')}.`
      : '';

    const response = await recipeChat({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: req.signal,
      body: JSON.stringify({
        model: MODEL_FAST,
        messages: [
          {
            role: 'system',
            content:
              'You are a culinary expert providing ingredient substitution recommendations. Provide practical, readily available substitutes with clear conversion ratios.',
          },
          {
            role: 'user',
            content: `Provide 3-5 substitute options for: ${ingredient}.${avoidLine} Return as JSON with this structure:
{
  "substitutes": [
    {
      "name": "substitute ingredient name",
      "ratio": "conversion ratio (e.g., 1:1, 2:1)",
      "notes": "important notes about taste/texture differences"
    }
  ]
}`,
          },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    }, { totalMs: 45_000 });

    if (!response.ok) {
      throw new Error('Failed to get substitutes from AI');
    }

    const data = await response.json();
    const choice = data?.choices?.[0];
    const content = choice?.message?.content;

    // Refused, truncated or otherwise unfinished answers are never accepted.
    if (choice?.finish_reason !== 'stop' || choice?.message?.refusal || typeof content !== 'string' || !content) {
      throw new Error('No complete content in AI response');
    }

    // Throws on malformed or wrongly shaped output; unknown fields are dropped.
    const { substitutes } = substitutesSchema.parse(JSON.parse(extractJsonPayload(content)));

    // The prompt asks the model to avoid these foods; this check enforces it.
    const safe = substitutes.filter((sub) =>
      !findBlockedFood(sub.name, profile.allergies, 'allergy')
      && !findBlockedFood(sub.name, profile.dislikedIngredients, 'dislike'));

    return NextResponse.json({ substitutes: safe });
  } catch (error) {
    if (req.signal.aborted) return new NextResponse(null, { status: 499 });
    // Raw errors can quote provider output; never log or return them.
    console.error('Substitute API error:', error instanceof Error ? error.name : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to get ingredient substitutes' },
      { status: 500 }
    );
  }
}
