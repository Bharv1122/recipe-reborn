import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { MobileAuthError, requireMobileUserId } from '@/lib/mobile-auth';

const schema = z.object({ password: z.string().min(1).max(200), confirmation: z.literal('DELETE') });

export async function POST(request: Request) {
  try {
    const userId = requireMobileUserId(request);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Enter your password and type DELETE.' }, { status: 400 });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true, stripeSubscriptionId: true, subscriptionStatus: true },
    });
    if (!user?.password || !(await bcrypt.compare(parsed.data.password, user.password))) {
      return NextResponse.json({ error: 'Password is incorrect.' }, { status: 403 });
    }
    if (user.stripeSubscriptionId && ['active', 'trialing', 'past_due'].includes(user.subscriptionStatus)) {
      return NextResponse.json(
        { error: 'Cancel your Stripe subscription from Account first, then return to delete your account.' },
        { status: 409 },
      );
    }
    await prisma.user.delete({ where: { id: userId } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Mobile account deletion error:', error);
    return NextResponse.json({ error: 'Unable to delete account.' }, { status: 500 });
  }
}
