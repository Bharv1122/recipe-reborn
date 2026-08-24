import { z } from 'zod';
import { NextResponse } from 'next/server';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { MobileAuthError, rotateMobileRefreshToken } from '@/lib/mobile-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const limited = await rateLimit(`mobile-refresh:${getClientIp(request)}`, 30, 300);
    if (!limited.success) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

    const parsed = z.object({ refreshToken: z.string().min(40).max(300) })
      .safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Session expired.' }, { status: 401 });

    return NextResponse.json({ tokens: await rotateMobileRefreshToken(parsed.data.refreshToken) });
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error('Mobile refresh error:', error);
    return NextResponse.json({ error: 'Unable to refresh session.' }, { status: 500 });
  }
}
