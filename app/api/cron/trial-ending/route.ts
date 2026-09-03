import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail, trialEndingEmail, appUrl, isEmailConfigured } from '@/lib/email';
import { findPartnerOffer, PARTNER_OFFERS } from '@/lib/partner-offers';
import { SUPPORT_EMAIL } from '@/lib/support';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Daily nudge for partner trials about to lapse.
 *
 * A partner trial has no payment method behind it, so Stripe cancels it in
 * silence and the account slides back to the free tier with the user none the
 * wiser. Without this the campaign has no conversion step at all.
 *
 * Runs from vercel.json. Protected by CRON_SECRET: Vercel sends it as a bearer
 * token, and without that the endpoint would be an open email trigger.
 */

// Far enough out to act on, close enough to feel relevant.
const NOTIFY_WINDOW_START_DAYS = 4;
const NOTIFY_WINDOW_END_DAYS = 6;

// "Already nudged" is recorded in VerificationToken rather than a new column,
// the same trick the password-reset flow uses — no migration for a flag.
const SENT_PREFIX = 'trial-nudge:';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error('[trial-nudge] CRON_SECRET is not set — refusing to run.');
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isEmailConfigured()) {
    console.error('[trial-nudge] Email is not configured — nothing sent.');
    return NextResponse.json({ error: 'Email not configured' }, { status: 503 });
  }

  try {
    const now = Date.now();
    const directOfferSlugs = PARTNER_OFFERS
      .filter((offer) => offer.directAccess)
      .map((offer) => offer.slug);
    const expired = directOfferSlugs.length
      ? await prisma.user.updateMany({
          where: {
            signupSource: { in: directOfferSlugs },
            subscriptionTier: 'premium',
            subscriptionStatus: 'trialing',
            stripeSubscriptionId: null,
            currentPeriodEnd: { lt: new Date(now) },
          },
          data: {
            subscriptionTier: 'free',
            subscriptionStatus: 'canceled',
          },
        })
      : { count: 0 };
    const windowStart = new Date(now + NOTIFY_WINDOW_START_DAYS * 86_400_000);
    const windowEnd = new Date(now + NOTIFY_WINDOW_END_DAYS * 86_400_000);

    const candidates = await prisma.user.findMany({
      where: {
        subscriptionStatus: 'trialing',
        signupSource: { not: null },
        currentPeriodEnd: { gte: windowStart, lte: windowEnd },
        email: { not: null },
      },
      select: {
        id: true,
        email: true,
        signupSource: true,
        currentPeriodEnd: true,
        generationCount: true,
      },
    });

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const user of candidates) {
      // Only partner trials — an ordinary 7-day trial has a card on file and
      // converts by itself, so nudging it would just be noise.
      const offer = findPartnerOffer(user.signupSource);
      if (!offer || !user.email || !user.currentPeriodEnd) {
        skipped += 1;
        continue;
      }

      const marker = `${SENT_PREFIX}${user.id}`;
      const already = await prisma.verificationToken.findFirst({
        where: { identifier: marker },
      });

      if (already) {
        skipped += 1;
        continue;
      }

      const daysLeft = Math.max(
        1,
        Math.round((user.currentPeriodEnd.getTime() - now) / 86_400_000)
      );

      const { subject, html, text } = trialEndingEmail({
        offerLabel: offer.label,
        daysLeft,
        recipesCreated: user.generationCount,
        pricingUrl: `${appUrl()}/pricing`,
        feedbackEmail: SUPPORT_EMAIL,
      });

      const ok = await sendEmail({ to: user.email, subject, html, text });

      if (!ok) {
        // No marker written, so tomorrow's run retries rather than silently
        // dropping the only conversion touchpoint this campaign has.
        failed += 1;
        continue;
      }

      // Token doubles as the sent-flag; expiry only exists to let old rows be
      // cleaned up, it is never redeemed.
      await prisma.verificationToken.create({
        data: {
          identifier: marker,
          token: `${marker}:${randomSuffix()}`,
          expires: new Date(now + 90 * 86_400_000),
        },
      });

      sent += 1;
    }

    console.log(
      `[trial-nudge] expired=${expired.count} candidates=${candidates.length} sent=${sent} skipped=${skipped} failed=${failed}`
    );

    return NextResponse.json({ expired: expired.count, candidates: candidates.length, sent, skipped, failed });
  } catch (error) {
    console.error('[trial-nudge] Run failed:', error);
    return NextResponse.json({ error: 'Run failed' }, { status: 500 });
  }
}

/** VerificationToken.token is globally unique, so keep the marker unique too. */
function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}
