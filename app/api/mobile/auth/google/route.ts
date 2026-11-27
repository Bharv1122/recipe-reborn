import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { issueMobileTokenPair } from '@/lib/mobile-auth';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { verifyGoogleMobileIdentity } from '@/lib/google-mobile-identity';

const schema = z.object({ idToken: z.string().min(1).max(12000), nonce: z.string().regex(/^[a-f0-9]{64}$/),
  adultConfirmed: z.boolean().optional(), linkPassword: z.string().min(1).max(200).optional(),
  deviceName: z.string().trim().max(120).optional(), platform: z.enum(['android', 'ios']).optional() });
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const clientId = process.env.GOOGLE_MOBILE_WEB_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: 'Google sign-in is not available yet. Use email and password.' }, { status: 503 });
  try {
    if (!(await rateLimit(`google-login:${getClientIp(request)}`, 8, 300)).success) return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Please start Google sign-in again.' }, { status: 400 });
    const body = parsed.data;
    let identity: Awaited<ReturnType<typeof verifyGoogleMobileIdentity>>;
    try { identity = await verifyGoogleMobileIdentity(body.idToken, body.nonce, clientId); }
    catch { return NextResponse.json({ error: 'Google could not verify this sign-in. Please try again.' }, { status: 401 }); }
    // Consume once before any account action, including unsuccessful linking attempts.
    const consumed = await prisma.verificationToken.deleteMany({ where: { identifier: 'mobile-google', token: body.nonce, expires: { gt: new Date() } } });
    if (consumed.count !== 1) return NextResponse.json({ error: 'Sign-in expired. Please start again.' }, { status: 401 });
    const linked = await prisma.account.findUnique({ where: { provider_providerAccountId: { provider: 'google', providerAccountId: identity.subject } }, include: { user: true } });
    let user = linked?.user;
    if (!user) {
      const existing = await prisma.user.findUnique({ where: { email: identity.email } });
      if (existing) {
        // Verified email alone never grants access to an existing RecipeReborn account.
        if (!existing.password) {
          return NextResponse.json({ error: 'This existing account has no RecipeReborn password. Use Forgot password to set one before connecting Google.', code: 'LINK_PASSWORD_SETUP_REQUIRED' }, { status: 409 });
        }
        if (!body.linkPassword) {
          return NextResponse.json({ error: 'To connect Google to your existing account, enter its RecipeReborn password and try Google again. You can also use email sign-in or reset your password.', code: 'LINK_PASSWORD_REQUIRED' }, { status: 409 });
        }
        if (!await bcrypt.compare(body.linkPassword, existing.password)) {
          return NextResponse.json({ error: 'That RecipeReborn password could not be verified for the selected Google account. Use Forgot password if you are unsure.', code: 'LINK_PASSWORD_INVALID' }, { status: 409 });
        }
        const linkedSafely = await prisma.$transaction(async tx => {
          const otherGoogle = await tx.account.findFirst({ where: { userId: existing.id, provider: 'google' } });
          if (otherGoogle) return false;
          await tx.account.create({ data: { userId: existing.id, type: 'oauth', provider: 'google', providerAccountId: identity.subject } });
          return true;
        }, { isolationLevel: 'Serializable' });
        if (!linkedSafely) return NextResponse.json({ error: 'This account is connected to another Google identity. Use email sign-in.' }, { status: 409 });
        user = existing;
      } else {
        if (body.adultConfirmed !== true) return NextResponse.json({ error: 'Confirm you are 18 or older to create an account, then try Google again.', code: 'ADULT_CONFIRMATION_REQUIRED' }, { status: 400 });
        user = await prisma.user.create({ data: { email: identity.email, emailVerified: new Date(), name: identity.name, signupSource: 'mobile',
          accounts: { create: { type: 'oauth', provider: 'google', providerAccountId: identity.subject } } } });
      }
    }
    const tokens = await issueMobileTokenPair(user.id, body);
    return NextResponse.json({ tokens, user: { id: user.id, email: user.email, name: user.name, allergies: user.allergies, dislikedIngredients: user.dislikedIngredients, likedIngredients: user.likedIngredients } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    // Never log tokens, provider claims or account-link passwords.
    return NextResponse.json({ error: 'Unable to finish sign-in. Please try again or use email and password.' }, { status: 500 });
  }
}
