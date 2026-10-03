import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Shared per-user budget for AI routes that don't already count against the
 * monthly recipe limit. Every call to these routes is a paid Gemini request,
 * so without a cap one account could run up the bill.
 *
 * Two windows: a short burst limit, and a daily cap shared across all
 * metered AI features. Normal use (a few questions per recipe) never gets
 * near either one.
 */
const PER_MINUTE = 20;
const PER_DAY = 300;

export async function limitAiRequest(userId: string): Promise<NextResponse | null> {
  const minute = await rateLimit(`ai-minute:${userId}`, PER_MINUTE, 60);
  if (!minute.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a minute and try again.' },
      { status: 429, headers: { 'Retry-After': String(minute.reset) } },
    );
  }

  const day = await rateLimit(`ai-day:${userId}`, PER_DAY, 60 * 60 * 24);
  if (!day.success) {
    return NextResponse.json(
      { error: "You've reached today's AI limit. It resets tomorrow." },
      { status: 429, headers: { 'Retry-After': String(day.reset) } },
    );
  }

  return null;
}
