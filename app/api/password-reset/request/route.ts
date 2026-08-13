import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { sendEmail, passwordResetEmail, appUrl, isEmailConfigured } from '@/lib/email';
import { TOKEN_TTL_MINUTES, resetIdentifier, hashResetToken } from '@/lib/password-reset';

/**
 * Always answered with the same 200 body, whether or not the address has an
 * account. Anything else turns this endpoint into an account-enumeration oracle.
 */
const GENERIC_RESPONSE = {
  message:
    "If an account exists for that email, we've sent a link to reset the password.",
};

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { success } = await rateLimit(`password-reset:${ip}`, 5, 900);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many reset requests. Please try again in a few minutes.' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawEmail = (body as { email?: unknown }).email;
    // Emails are stored lowercase (see signup route) — normalize to match.
    const email =
      typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
    }

    // Second limit keyed on the address so one attacker can't spam a single
    // inbox from a rotating pool of IPs.
    const perEmail = await rateLimit(`password-reset-email:${email}`, 3, 900);
    if (!perEmail.success) {
      return NextResponse.json(GENERIC_RESPONSE);
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // No account, or an account with no password (shouldn't happen today, but
    // would exist if an OAuth provider is added later): stop here and return
    // the same body as the success path.
    if (!user?.password) {
      return NextResponse.json(GENERIC_RESPONSE);
    }

    const identifier = resetIdentifier(email);

    // Supersede any outstanding links so only the newest email works.
    await prisma.verificationToken.deleteMany({ where: { identifier } });

    // The raw token goes in the email; only its hash is persisted, so read
    // access to the database doesn't hand over working reset links.
    const rawToken = crypto.randomBytes(32).toString('hex');

    await prisma.verificationToken.create({
      data: {
        identifier,
        token: hashResetToken(rawToken),
        expires: new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000),
      },
    });

    const resetUrl = `${appUrl()}/reset-password?token=${rawToken}`;

    // Local dev without Brevo configured has no way to receive the link, which
    // would make the flow untestable. Print it to the server console instead —
    // never in production, and never when real email is available.
    if (process.env.NODE_ENV !== 'production' && !isEmailConfigured()) {
      console.log(`[password-reset] dev reset link for ${email}: ${resetUrl}`);
    }

    const { subject, html, text } = passwordResetEmail(resetUrl, TOKEN_TTL_MINUTES);
    const sent = await sendEmail({ to: email, subject, html, text });

    if (!sent) {
      // Deliberately still a 200: the client must not learn whether an address
      // is registered. The failure is already logged inside sendEmail().
      console.error('[password-reset] Could not deliver reset email');
    }

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (error) {
    console.error('Password reset request error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
