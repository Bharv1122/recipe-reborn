import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { resolvePartnerTrial } from '@/lib/partner-offer-server';
import { buildTrialCheckoutSettings } from '@/lib/partner-checkout';

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

    // Extended partner trials are resolved from the stored account record, not
    // from the request body — the client never gets a say in trial length.
    const { offer, trialDays } = await resolvePartnerTrial(user);
    const offerSlug = offer?.slug ?? null;
    const trialSettings = buildTrialCheckoutSettings(Boolean(offerSlug), trialDays);

    // Get origin from request headers for dynamic URL construction
    const origin = request.headers.get('origin') || 'http://localhost:3000';

    // Create Stripe checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
      // Code holders are promised a free month with no card. The trial has $0
      // due today, so 'if_required' collects nothing; everyone else still
      // enters a payment method upfront as before.
      ...trialSettings,
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
