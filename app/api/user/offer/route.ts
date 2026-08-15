import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { DEFAULT_TRIAL_DAYS } from '@/lib/partner-offers';
import { resolvePartnerTrial } from '@/lib/partner-offer-server';

export const dynamic = 'force-dynamic';

/**
 * The trial this account will actually get at checkout.
 *
 * Display only — create-checkout-session re-resolves the same thing server-side
 * and is the authority. This exists so a logged-in partner member sees the real
 * number on the pricing page instead of the generic 7 days.
 *
 * `authenticated` distinguishes "this account definitively has no offer" from
 * "I could not determine anything". Only the former should clear a banner the
 * client already decided to show from its invite link.
 */
const UNKNOWN = {
  authenticated: false,
  trialDays: DEFAULT_TRIAL_DAYS,
  offer: null,
};

const NO_OFFER = {
  authenticated: true,
  trialDays: DEFAULT_TRIAL_DAYS,
  offer: null,
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    // A signed-out visitor holding a valid invite link must still see the
    // banner, so this is "unknown", not "no offer".
    if (!session?.user?.id) {
      return NextResponse.json(UNKNOWN);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { signupSource: true, createdAt: true },
    });

    if (!user) {
      return NextResponse.json(NO_OFFER);
    }

    // Same resolver checkout uses, so the banner can never promise a trial
    // the checkout session would not actually create.
    const { offer, trialDays, trialRecipeLimit } = await resolvePartnerTrial(user);

    if (!offer) {
      return NextResponse.json(NO_OFFER);
    }

    return NextResponse.json({
      authenticated: true,
      trialDays,
      offer: { slug: offer.slug, label: offer.label, trialDays, trialRecipeLimit },
    });
  } catch (error) {
    console.error('User offer lookup error:', error);
    // Never block the pricing page on this. Reported as unknown because we did
    // not actually determine anything.
    return NextResponse.json(UNKNOWN);
  }
}
