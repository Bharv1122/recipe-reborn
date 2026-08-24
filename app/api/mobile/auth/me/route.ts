import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { MobileAuthError, requireMobileUserId } from '@/lib/mobile-auth';
import { resolvePartnerTrial } from '@/lib/partner-offer-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const userId = requireMobileUserId(request);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, createdAt: true, signupSource: true,
        subscriptionTier: true, subscriptionStatus: true, currentPeriodEnd: true,
        allergies: true, dislikedIngredients: true,
      },
    });
    if (!user) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

    const resolved = await resolvePartnerTrial(user);
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        allergies: user.allergies,
        dislikedIngredients: user.dislikedIngredients,
      },
      entitlement: {
        tier: user.subscriptionTier,
        status: user.subscriptionStatus,
        currentPeriodEnd: user.currentPeriodEnd?.toISOString() ?? null,
        trial: user.subscriptionStatus === 'trialing' || user.signupSource === resolved.offer?.slug
          ? {
              label: resolved.offer?.label ?? 'Recipe Reborn trial',
              days: resolved.trialDays,
              fullPremium: resolved.fullPremium,
              recipeLimit: resolved.trialRecipeLimit,
            }
          : null,
      },
    });
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Mobile account error:', error);
    return NextResponse.json({ error: 'Unable to load account.' }, { status: 500 });
  }
}
