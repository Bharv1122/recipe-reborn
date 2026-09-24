import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getRequestUserId } from '@/lib/request-auth';
import { AI_API_KEY, AI_CHAT_URL, MODEL_FAST } from '@/lib/ai';

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(2000),
});
const requestSchema = z.object({ messages: z.array(messageSchema).min(1).max(20) });

export async function POST(request: Request) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let abortAnswer: (() => void) | undefined;
  let timedOut = false;
  let providerStarted = false;
  try {
    const userId = await getRequestUserId(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    const controller = new AbortController();
    abortAnswer = () => controller.abort();
    request.signal.addEventListener('abort', abortAnswer, { once: true });
    if (request.signal.aborted) controller.abort();
    timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 45_000);
    providerStarted = true;
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
        reasoning_effort: 'none',
      }),
      signal: controller.signal,
    });
    if (!response.ok) return NextResponse.json(
      { error: 'AI Chef could not answer right now. Please try again.' },
      { status: response.status === 429 || response.status === 503 ? 503 : 502 },
    );
    const data = await response.json();
    const choice = data?.choices?.[0];
    if (choice?.finish_reason === 'length') return NextResponse.json(
      { error: 'AI Chef could not finish that answer. Please ask a shorter question or try again.' },
      { status: 502 },
    );
    const answer = choice?.message?.content;
    if (choice?.finish_reason !== 'stop' || typeof answer !== 'string' || !answer.trim()) {
      return NextResponse.json({ error: 'AI Chef did not return a complete answer. Please try again.' }, { status: 502 });
    }
    return NextResponse.json({ message: { role: 'assistant', content: answer.trim() } });
  } catch {
    if (timedOut) return NextResponse.json({ error: 'AI Chef took too long to answer. Please try again.' }, { status: 504 });
    if (request.signal.aborted) return NextResponse.json({ error: 'Question canceled.' }, { status: 499 });
    // Never log provider payloads, questions, account preferences, or raw errors.
    console.error('[chef-chat] request failed', { stage: providerStarted ? 'provider' : 'account' });
    return NextResponse.json({ error: 'AI Chef could not answer right now. Please try again.' }, { status: providerStarted ? 502 : 500 });
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
    if (abortAnswer) request.signal.removeEventListener('abort', abortAnswer);
  }
}
