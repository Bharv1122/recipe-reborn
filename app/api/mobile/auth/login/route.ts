import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { issueMobileTokenPair } from '@/lib/mobile-auth';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(200),
  deviceName: z.string().trim().max(120).optional(),
  platform: z.enum(['ios', 'android']).optional(),
});

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limited = await rateLimit(`mobile-login:${ip}`, 8, 300);
    if (!limited.success) {
      return NextResponse.json({ error: 'Too many attempts. Try again in a few minutes.' }, { status: 429 });
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Enter a valid email and password.' }, { status: 400 });

    const email = parsed.data.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.password || !(await bcrypt.compare(parsed.data.password, user.password))) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const tokens = await issueMobileTokenPair(user.id, parsed.data);
    return NextResponse.json({
      tokens,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    console.error('Mobile login error:', error);
    return NextResponse.json({ error: 'Unable to sign in right now.' }, { status: 500 });
  }
}
