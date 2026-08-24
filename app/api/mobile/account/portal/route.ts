import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { MobileAuthError, requireMobileUserId } from '@/lib/mobile-auth';

export async function POST(request: Request) {
  try {
    const userId = requireMobileUserId(request);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } });
    if (!user?.stripeCustomerId) return NextResponse.json({ error: 'No Stripe subscription is attached to this account.' }, { status: 404 });
    const portal = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: 'https://recipereborn.com/account',
    });
    return NextResponse.json({ url: portal.url });
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Mobile billing portal error:', error);
    return NextResponse.json({ error: 'Unable to open subscription management.' }, { status: 500 });
  }
}
