import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { isOfferLive, partnerTrialEndsAt, resolveSignupAttribution } from '@/lib/partner-offers';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { success } = await rateLimit(`signup:${ip}`, 5, 60);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Please try again in a minute.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email: rawEmail, password, confirmPassword, src, code } = body;
    // Case-insensitive matching: mixed-case signups created duplicate/unfindable
    // accounts in the old app — always store lowercase
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : rawEmail;

    if (!email || !password || !confirmPassword) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Community offers are code-only. Campaign links still provide ordinary
    // attribution, but a URL such as ?src=Finnsters cannot grant the trial.
    const { typedOffer, signupSource } = resolveSignupAttribution(
      typeof code === 'string' ? code : null,
      typeof src === 'string' ? src : null,
    );

    // Direct-access and lifetime offers land the account on Premium at signup.
    // Capacity is checked here too, otherwise signup could bypass redemption
    // limits.
    let offerGranted = false;
    if ((typedOffer?.lifetime || typedOffer?.directAccess) && isOfferLive(typedOffer)) {
      const taken = await prisma.user.count({
        where: {
          signupSource: { equals: typedOffer.slug, mode: 'insensitive' },
          ...(typedOffer.lifetime
            ? { subscriptionTier: 'premium', stripeSubscriptionId: null }
            : {}),
        },
      });
      offerGranted = taken < typedOffer.maxRedemptions;
    }

    const grantedAt = new Date();

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        ...(signupSource ? { signupSource } : {}),
        ...(offerGranted
          ? {
              subscriptionTier: 'premium',
              subscriptionStatus: typedOffer?.lifetime ? 'active' : 'trialing',
              currentPeriodEnd: typedOffer?.directAccess
                ? partnerTrialEndsAt(typedOffer, grantedAt)
                : null,
              partnerOfferRedeemedCode: typedOffer!.slug,
              partnerOfferRedeemedAt: grantedAt,
            }
          : {}),
      },
    });

    return NextResponse.json(
      { message: 'User created successfully', user: { id: user.id, email: user.email } },
      { status: 201 }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    );
  }
}
