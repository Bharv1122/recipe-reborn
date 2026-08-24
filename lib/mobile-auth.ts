import crypto from 'crypto';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { prisma } from '@/lib/db';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_DAYS = 30;
const ISSUER = 'recipe-reborn';
const AUDIENCE = 'recipe-reborn-mobile';

export class MobileAuthError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'MobileAuthError';
  }
}

function signingSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET is required for mobile authentication');
  return secret;
}

function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createOpaqueToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

function signAccessToken(userId: string): string {
  return jwt.sign(
    { type: 'access' },
    signingSecret(),
    {
      subject: userId,
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      algorithm: 'HS256',
    },
  );
}

export interface MobileTokenPair {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export async function issueMobileTokenPair(
  userId: string,
  device: { deviceName?: string; platform?: string } = {},
): Promise<MobileTokenPair> {
  const refreshToken = createOpaqueToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.mobileRefreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      deviceName: device.deviceName?.slice(0, 120) || null,
      platform: device.platform?.slice(0, 30) || null,
      expiresAt,
    },
  });

  return {
    accessToken: signAccessToken(userId),
    accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
    refreshToken,
    refreshTokenExpiresAt: expiresAt.toISOString(),
  };
}

export async function rotateMobileRefreshToken(refreshToken: string): Promise<MobileTokenPair> {
  if (!refreshToken || refreshToken.length < 40) throw new MobileAuthError();

  const now = new Date();
  const existing = await prisma.mobileRefreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(refreshToken) },
  });
  if (!existing || existing.revokedAt || existing.expiresAt <= now) {
    throw new MobileAuthError('Session expired');
  }

  const nextRefreshToken = createOpaqueToken();
  const nextExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    const revoked = await tx.mobileRefreshToken.updateMany({
      where: { id: existing.id, revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now, lastUsedAt: now },
    });
    if (revoked.count !== 1) throw new MobileAuthError('Session expired');

    await tx.mobileRefreshToken.create({
      data: {
        userId: existing.userId,
        tokenHash: hashRefreshToken(nextRefreshToken),
        deviceName: existing.deviceName,
        platform: existing.platform,
        expiresAt: nextExpiresAt,
      },
    });
  });

  return {
    accessToken: signAccessToken(existing.userId),
    accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
    refreshToken: nextRefreshToken,
    refreshTokenExpiresAt: nextExpiresAt.toISOString(),
  };
}

export async function revokeMobileRefreshToken(refreshToken: string): Promise<void> {
  if (!refreshToken) return;
  await prisma.mobileRefreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function verifyMobileAccessToken(token: string): string {
  try {
    const payload = jwt.verify(token, signingSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    }) as JwtPayload;
    if (payload.type !== 'access' || typeof payload.sub !== 'string') throw new MobileAuthError();
    return payload.sub;
  } catch (error) {
    if (error instanceof MobileAuthError) throw error;
    throw new MobileAuthError();
  }
}

export function requireMobileUserId(request: Request): string {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) throw new MobileAuthError();
  return verifyMobileAccessToken(authorization.slice(7).trim());
}
