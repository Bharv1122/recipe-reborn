import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { findPartnerOffer, isOfferLive } from '@/lib/partner-offers';
import { resolvePartnerTrial } from '@/lib/partner-offer-server';

export const dynamic = 'force-dynamic';

const INVALID = 'That code is not recognised. Check the spelling and try again.';

/**
 * Redeem a community code on an existing account.
 *
 * The code is stored in User.signupSource, the same field the invite links
 * populate — typing "Finnsters" and arriving via the Finnsters link mean the
 * same thing, so they should not be two separate mechanisms. Entitlement is
 * still recomputed server-side at checkout; this only records which community
 * the account belongs to.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Please sign in first' }, { status: 401 });
    }

    // Codes are short and guessable by design, so throttle attempts.
    const ip = getClientIp(request);
    const { success } = await rateLimit(`redeem:${ip}`, 10, 300);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again in a few minutes.' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const offer = findPartnerOffer((body as { code?: unknown }).code as string);

    if (!offer) {
      return NextResponse.json({ error: INVALID }, { status: 400 });
    }

    if (!isOfferLive(offer)) {
      return NextResponse.json(
        { error: `The ${offer.label} offer has ended.` },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, signupSource: true, createdAt: true, subscriptionTier: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Already on a paid plan — nothing to unlock, and we should not quietly
    // rewrite their attribution.
    if (user.subscriptionTier !== 'free') {
      return NextResponse.json(
        { error: 'Your account is already on Premium.' },
        { status: 400 }
      );
    }

    if (user.signupSource !== offer.slug) {
      await prisma.user.update({
        where: { id: user.id },
        data: { signupSource: offer.slug },
      });
    }

    // Re-resolve after writing so the response reflects reality — including
    // the case where the offer is full and they get the standard trial.
    const resolved = await resolvePartnerTrial({
      signupSource: offer.slug,
      createdAt: user.createdAt,
    });

    if (!resolved.offer) {
      return NextResponse.json(
        {
          error: `The ${offer.label} offer has reached its limit, so the standard ${resolved.trialDays}-day trial applies.`,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      message: `${offer.label} unlocked — ${resolved.trialDays} days free.`,
      offer: {
        slug: offer.slug,
        label: offer.label,
        trialDays: resolved.trialDays,
        trialRecipeLimit: resolved.trialRecipeLimit,
      },
    });
  } catch (error) {
    console.error('Partner offer redeem error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
