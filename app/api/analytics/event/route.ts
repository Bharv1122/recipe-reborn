import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

const ALLOWED_EVENTS = new Set([
  'preview_started', 'signup_viewed', 'signup_completed',
  'profile_completed', 'recipe_generated', 'return_visit',
]);

function clean(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const ip = getClientIp(request);
    const { success } = await rateLimit(`funnel:${ip}`, 60, 60);
    if (!success) return NextResponse.json({ error: 'Too many events' }, { status: 429 });

    const body = await request.json();
    const eventName = clean(body?.event, 40);
    if (!eventName || !ALLOWED_EVENTS.has(eventName)) {
      return NextResponse.json({ error: 'Unknown analytics event' }, { status: 400 });
    }

    await prisma.funnelEvent.create({
      data: {
        eventName,
        path: clean(body?.path, 120),
        source: clean(body?.source, 60),
      },
    });
    console.log(JSON.stringify({ level: 'info', msg: 'funnel event recorded', event: eventName, ms: Date.now() - startedAt }));
    return NextResponse.json({ recorded: true }, { status: 202 });
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', msg: 'funnel event failed', error: error instanceof Error ? error.message : String(error), ms: Date.now() - startedAt }));
    return NextResponse.json({ error: 'Could not record event' }, { status: 500 });
  }
}
