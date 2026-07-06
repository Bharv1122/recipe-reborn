import crypto from 'crypto';
import { prisma } from './db';

// Anonymous "try it free" scans are capped per IP, backed by Postgres so it
// works without Redis/Upstash. This endpoint hits the paid AI API with no
// auth, so on any error we fail CLOSED — a blocked guest can always sign up.

export const GUEST_LIMIT = 3;
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex');
}

export interface GuestLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
}

export async function checkGuestLimit(ip: string): Promise<GuestLimitResult> {
  const ipHash = hashIp(ip);
  const now = new Date();

  try {
    const existing = await prisma.guestUsage.findUnique({ where: { ipHash } });

    // Fresh IP or expired window → start a new window at count 1
    if (!existing || existing.windowEnd < now) {
      await prisma.guestUsage.upsert({
        where: { ipHash },
        create: { ipHash, count: 1, windowEnd: new Date(now.getTime() + WINDOW_MS) },
        update: { count: 1, windowEnd: new Date(now.getTime() + WINDOW_MS) },
      });
      return { allowed: true, remaining: GUEST_LIMIT - 1, limit: GUEST_LIMIT };
    }

    if (existing.count >= GUEST_LIMIT) {
      return { allowed: false, remaining: 0, limit: GUEST_LIMIT };
    }

    const updated = await prisma.guestUsage.update({
      where: { ipHash },
      data: { count: { increment: 1 } },
    });
    return {
      allowed: true,
      remaining: Math.max(0, GUEST_LIMIT - updated.count),
      limit: GUEST_LIMIT,
    };
  } catch (error) {
    console.error('Guest rate limit check failed (failing closed):', error);
    return { allowed: false, remaining: 0, limit: GUEST_LIMIT };
  }
}
