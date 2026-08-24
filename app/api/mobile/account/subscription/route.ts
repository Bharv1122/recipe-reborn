import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { MobileAuthError, requireMobileUserId } from '@/lib/mobile-auth';

export async function GET(request: Request) {
  try {
    const userId = requireMobileUserId(request);
    const account = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true, subscriptionStatus: true, generationCount: true, lastGenerationReset: true, currentPeriodEnd: true, stripeCustomerId: true, stripeSubscriptionId: true },
    });
    if (!account) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    return NextResponse.json({
      subscription: {
        tier: account.subscriptionTier,
        status: account.subscriptionStatus,
        generationCount: account.generationCount,
        lastGenerationReset: account.lastGenerationReset,
        currentPeriodEnd: account.currentPeriodEnd,
        canManageOnWeb: Boolean(account.stripeCustomerId),
        hasStripeSubscription: Boolean(account.stripeSubscriptionId),
      },
    });
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Unable to load subscription.' }, { status: 500 });
  }
}
