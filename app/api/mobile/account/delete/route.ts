import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { MobileAuthError, requireMobileUserId } from '@/lib/mobile-auth';
import { verifyGoogleMobileIdentity } from '@/lib/google-mobile-identity';
import { rateLimit } from '@/lib/rate-limit';

const schema = z.object({ password: z.string().min(1).max(200).optional(), confirmation: z.literal('DELETE'),
  idToken: z.string().min(1).max(12000).optional(), nonce: z.string().regex(/^[a-f0-9]{64}$/).optional() });

export async function POST(request: Request) {
  try {
    const userId = requireMobileUserId(request);
    if (!(await rateLimit(`mobile-delete:${userId}`, 8, 300)).success) return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Enter your password and type DELETE.' }, { status: 400 });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true, stripeSubscriptionId: true, subscriptionStatus: true },
    });
    if (!user) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    let verified = false;
    if (parsed.data.idToken && parsed.data.nonce && process.env.GOOGLE_MOBILE_WEB_CLIENT_ID) {
      try {
        const identity = await verifyGoogleMobileIdentity(parsed.data.idToken, parsed.data.nonce, process.env.GOOGLE_MOBILE_WEB_CLIENT_ID);
        const consumed = await prisma.verificationToken.deleteMany({ where: { identifier: 'mobile-google', token: parsed.data.nonce, expires: { gt: new Date() } } });
        const linked = await prisma.account.findUnique({ where: { provider_providerAccountId: { provider: 'google', providerAccountId: identity.subject } }, select: { userId: true } });
        verified = consumed.count === 1 && linked?.userId === userId;
      } catch { verified = false; }
    } else if (user.password && parsed.data.password) {
      verified = await bcrypt.compare(parsed.data.password, user.password);
    }
    if (!verified) {
      return NextResponse.json({ error: 'Verify with your password or the Google account linked to this account.' }, { status: 403 });
    }
    if (user.stripeSubscriptionId && ['active', 'trialing', 'past_due'].includes(user.subscriptionStatus)) {
      return NextResponse.json(
        { error: 'Cancel your active subscription through the service where it was purchased, then return to delete your account.' },
        { status: 409 },
      );
    }
    await prisma.user.delete({ where: { id: userId } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Unable to delete account.' }, { status: 500 });
  }
}
