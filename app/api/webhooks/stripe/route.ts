import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2026-02-25.clover',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = headers().get('stripe-signature');

    if (!signature) {
      console.error('Missing stripe-signature header');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json(
        { error: `Webhook Error: ${err.message}` },
        { status: 400 }
      );
    }

    // Handle the event
    console.log('Received Stripe event:', event.type);

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSuccess(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const subscriptionId = subscription.id;
  const priceId = subscription.items.data[0]?.price.id;

  // Determine tier based on price ID
  let tier = 'free';
  if (priceId === process.env.STRIPE_PREMIUM_PRICE_ID) {
    tier = 'premium';
  } else if (priceId === process.env.STRIPE_PRO_PRICE_ID) {
    tier = 'pro';
  }

  const status =
    subscription.status === 'active' || subscription.status === 'trialing'
      ? 'active'
      : subscription.status === 'past_due'
      ? 'past_due'
      : 'canceled';

  const currentPeriodEnd = (subscription as any).current_period_end 
    ? new Date((subscription as any).current_period_end * 1000)
    : new Date();

  // Update user in database
  await prisma.user.update({
    where: { stripeCustomerId: customerId },
    data: {
      subscriptionTier: tier,
      subscriptionStatus: status,
      stripeSubscriptionId: subscriptionId,
      currentPeriodEnd,
    },
  });

  console.log(
    `Updated subscription for customer ${customerId}: ${tier} (${status})`
  );
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  await prisma.user.update({
    where: { stripeCustomerId: customerId },
    data: {
      subscriptionTier: 'free',
      subscriptionStatus: 'canceled',
      stripeSubscriptionId: null,
      currentPeriodEnd: null,
    },
  });

  console.log(`Canceled subscription for customer ${customerId}`);
}

async function handlePaymentSuccess(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  // Reset generation count on successful payment (monthly billing)
  await prisma.user.update({
    where: { stripeCustomerId: customerId },
    data: {
      subscriptionStatus: 'active',
      generationCount: 0,
      lastGenerationReset: new Date(),
    },
  });

  console.log(`Payment succeeded for customer ${customerId}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  await prisma.user.update({
    where: { stripeCustomerId: customerId },
    data: {
      subscriptionStatus: 'past_due',
    },
  });

  console.log(`Payment failed for customer ${customerId}`);
}
