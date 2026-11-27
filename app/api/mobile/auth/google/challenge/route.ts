import { randomBytes, createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  if (!process.env.GOOGLE_MOBILE_WEB_CLIENT_ID) return NextResponse.json({ error: 'Google sign-in is not available yet. Use email and password.' }, { status: 503 });
  try {
    if (!(await rateLimit(`google-challenge:${getClientIp(request)}`, 8, 300)).success) return NextResponse.json({ error: 'Please wait before trying again.' }, { status: 429 });
    const challenge = randomBytes(32).toString('hex');
    const nonce = createHash('sha256').update(challenge).digest('hex');
    await prisma.verificationToken.deleteMany({ where: { identifier: 'mobile-google', expires: { lt: new Date() } } });
    await prisma.verificationToken.create({ data: { identifier: 'mobile-google', token: nonce, expires: new Date(Date.now() + 5 * 60_000) } });
    return NextResponse.json({ nonce, webClientId: process.env.GOOGLE_MOBILE_WEB_CLIENT_ID }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Unable to start Google sign-in.' }, { status: 503 });
  }
}
