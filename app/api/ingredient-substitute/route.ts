import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { MODEL_FAST } from '@/lib/ai';
import { recipeChat } from '@/lib/ai-provider';
import { limitAiRequest } from '@/lib/ai-rate-limit';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const aiLimited = await limitAiRequest(session.user.id);
    if (aiLimited) return aiLimited;

    const { ingredient } = await req.json();

    if (!ingredient) {
      return NextResponse.json(
        { error: 'Ingredient is required' },
        { status: 400 }
      );
    }

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
            content: `Provide 3-5 substitute options for: ${ingredient}. Return as JSON with this structure:
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

    const substitutes = JSON.parse(content);

    return NextResponse.json(substitutes);
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
