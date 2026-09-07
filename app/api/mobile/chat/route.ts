import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { MobileAuthError, requireMobileUserId } from '@/lib/mobile-auth';
import { AI_API_KEY, AI_CHAT_URL, MODEL_FAST } from '@/lib/ai';

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(2000),
});
const requestSchema = z.object({ messages: z.array(messageSchema).min(1).max(20) });

export async function POST(request: Request) {
  try {
    const userId = requireMobileUserId(request);
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Enter a cooking question.' }, { status: 400 });
    if (!AI_API_KEY) return NextResponse.json({ error: 'AI Chef is temporarily unavailable.' }, { status: 503 });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { allergies: true, dislikedIngredients: true },
    });
    if (!user) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

    const safetyContext = [
      user.allergies.length ? `The user's saved food allergies are: ${user.allergies.join(', ')}. Never recommend those ingredients or their derivatives.` : '',
      user.dislikedIngredients.length ? `The user's disliked ingredients are: ${user.dislikedIngredients.join(', ')}. Avoid them when suggesting food.` : '',
    ].filter(Boolean).join(' ');
    const response = await fetch(AI_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_API_KEY}` },
      body: JSON.stringify({
        model: MODEL_FAST,
        messages: [
          {
            role: 'system',
            content: `You are Recipe Reborn's AI Chef. Give concise, practical cooking help, substitutions, meal ideas, and techniques. Favor recipes made from basic ingredients over prepared products. ${safetyContext}`,
          },
          ...parsed.data.messages,
        ],
        temperature: 0.65,
        max_tokens: 600,
      }),
    });
    if (!response.ok) return NextResponse.json({ error: 'AI Chef could not answer right now.' }, { status: response.status });
    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content;
    if (typeof answer !== 'string' || !answer.trim()) throw new Error('AI Chef returned no answer.');
    return NextResponse.json({ message: { role: 'assistant', content: answer.trim() } });
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('[mobile-chat] failed', error);
    return NextResponse.json({ error: 'AI Chef could not answer right now.' }, { status: 500 });
  }
}
