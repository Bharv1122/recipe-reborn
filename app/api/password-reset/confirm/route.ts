import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import {
  MIN_PASSWORD_LENGTH,
  hashResetToken,
  isResetIdentifier,
  emailFromResetIdentifier,
} from '@/lib/password-reset';

const INVALID_TOKEN_MESSAGE =
  'That reset link is invalid or has expired. Request a new one.';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    // Tokens are 256 bits of randomness, so this is about limiting damage from
    // a broken client retry loop rather than stopping a realistic guess.
    const { success } = await rateLimit(`password-reset-confirm:${ip}`, 10, 900);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again in a few minutes.' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { token, password } = body as { token?: unknown; password?: unknown };

    if (typeof token !== 'string' || !token) {
      return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 400 });
    }

    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      );
    }

    const record = await prisma.verificationToken.findUnique({
      where: { token: hashResetToken(token) },
    });

    // Reject anything that isn't ours, so a token minted by another NextAuth
    // flow can never be redeemed as a password reset.
    if (!record || !isResetIdentifier(record.identifier)) {
      return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 400 });
    }

    if (record.expires < new Date()) {
      await prisma.verificationToken.delete({ where: { token: record.token } });
      return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 400 });
    }

    const email = emailFromResetIdentifier(record.identifier);
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      await prisma.verificationToken.delete({ where: { token: record.token } });
      return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 400 });
    }

    // Same cost factor as signup so reset passwords aren't cheaper to crack.
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update the password and burn the token together — a partial success here
    // would either lock the user out or leave a reusable link alive.
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      prisma.verificationToken.deleteMany({
        where: { identifier: record.identifier },
      }),
    ]);

    // Returning the email lets the client sign in immediately. Safe to expose:
    // whoever redeemed the token already controls that inbox.
    return NextResponse.json({
      message: 'Password updated. You can sign in with your new password.',
      email,
    });
  } catch (error) {
    console.error('Password reset confirm error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
