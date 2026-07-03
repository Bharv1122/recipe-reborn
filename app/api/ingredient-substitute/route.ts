import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { AI_CHAT_URL, AI_API_KEY, MODEL_FAST } from '@/lib/ai';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ingredient } = await req.json();

    if (!ingredient) {
      return NextResponse.json(
        { error: 'Ingredient is required' },
        { status: 400 }
      );
    }

    const response = await fetch(AI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_API_KEY}`,
      },
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
    });

    if (!response.ok) {
      throw new Error('Failed to get substitutes from AI');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    const substitutes = JSON.parse(content);

    return NextResponse.json(substitutes);
  } catch (error: any) {
    console.error('Substitute API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to get ingredient substitutes' },
      { status: 500 }
    );
  }
}
