import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  DEFAULT_TRIAL_DAYS,
  findPartnerOffer,
  isOfferLive,
} from '@/lib/partner-offers';

export const dynamic = 'force-dynamic';

/**
 * The trial this account will actually get at checkout.
 *
 * Display only — create-checkout-session re-resolves the same thing server-side
 * and is the authority. This exists so a logged-in partner member sees the real
 * number on the pricing page instead of the generic 7 days.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ trialDays: DEFAULT_TRIAL_DAYS, offer: null });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { signupSource: true },
    });

    const offer = findPartnerOffer(user?.signupSource);

    if (!offer || !isOfferLive(offer)) {
      return NextResponse.json({ trialDays: DEFAULT_TRIAL_DAYS, offer: null });
    }

    const redeemed = await prisma.user.count({
      where: { signupSource: offer.slug },
    });

    if (redeemed > offer.maxRedemptions) {
      return NextResponse.json({ trialDays: DEFAULT_TRIAL_DAYS, offer: null });
    }

    return NextResponse.json({
      trialDays: offer.trialDays,
      offer: { slug: offer.slug, label: offer.label, trialDays: offer.trialDays },
    });
  } catch (error) {
    console.error('User offer lookup error:', error);
    // Never block the pricing page on this — fall back to the standard trial.
    return NextResponse.json({ trialDays: DEFAULT_TRIAL_DAYS, offer: null });
  }
}
