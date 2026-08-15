import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import {
  DEFAULT_TRIAL_DAYS,
  findPartnerOffer,
  isOfferLive,
} from '@/lib/partner-offers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { priceId, plan } = body;

    if (!priceId) {
      return NextResponse.json(
        { error: 'Price ID is required' },
        { status: 400 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: user.name || undefined,
        metadata: {
          userId: user.id,
        },
      });

      customerId = customer.id;

      // Save customer ID to database
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Extended partner trials are resolved from the stored signupSource, not
    // from the request body — the client never gets a say in trial length.
    let trialDays = DEFAULT_TRIAL_DAYS;
    let offerSlug: string | null = null;
    const offer = findPartnerOffer(user.signupSource);

    if (offer && isOfferLive(offer)) {
      // Count accounts from this source rather than tracking redemptions in a
      // new table: signupSource is already stamped at signup and is the same
      // thing the cap is meant to limit.
      const redeemed = await prisma.user.count({
        where: { signupSource: offer.slug },
      });

      if (redeemed <= offer.maxRedemptions) {
        trialDays = offer.trialDays;
        offerSlug = offer.slug;
      }
    }

    // Get origin from request headers for dynamic URL construction
    const origin = request.headers.get('origin') || 'http://localhost:3000';

    // Create Stripe checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
      // Partner-offer members are promised a free month with no card. With a
      // 100%-trial the amount due today is $0, so 'if_required' collects
      // nothing; everyone else still enters a card upfront as before.
      payment_method_collection: offerSlug ? 'if_required' : 'always',
      subscription_data: {
        trial_period_days: trialDays,
        trial_settings: {
          end_behavior: {
            // No card on file at day 30 means the subscription simply ends and
            // the webhook drops them to the free tier. Never invoice someone
            // who was told they would not be charged.
            missing_payment_method: offerSlug ? 'cancel' : 'create_invoice',
          },
        },
      },
      allow_promotion_codes: true,
      client_reference_id: user.id,
      metadata: {
        userId: user.id,
        plan: plan || 'unknown',
        trialDays: String(trialDays),
        ...(offerSlug ? { partnerOffer: offerSlug } : {}),
      },
    });

    return NextResponse.json({ sessionId: checkoutSession.id, url: checkoutSession.url });
  } catch (error) {
    console.error('Create checkout session error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
