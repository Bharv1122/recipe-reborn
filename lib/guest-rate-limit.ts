import crypto from 'crypto';
import { prisma } from './db';

// Anonymous "try it free" scans are capped per IP, backed by Postgres so it
// works without Redis/Upstash. This endpoint hits the paid AI API with no
// auth, so on any error we fail CLOSED — a blocked guest can always sign up.

export const GUEST_LIMIT = 3; // per IP / 24h
// Global daily ceiling across ALL guests. Guests share the Gemini key with
// paying users, so this protects paid generation from anonymous load.
export const GUEST_GLOBAL_LIMIT = 150;
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24h
const GLOBAL_KEY = '__global_guest_budget__';

function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex');
}

export type GuestLimitReason = 'ok' | 'ip' | 'global';

export interface GuestLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  reason: GuestLimitReason;
}

// Increment a windowed counter row and return its new count (resets when the
// window has passed). Shared by the per-IP and global budgets.
async function bumpCounter(key: string, now: Date): Promise<number> {
  const existing = await prisma.guestUsage.findUnique({ where: { ipHash: key } });
  if (!existing || existing.windowEnd < now) {
    await prisma.guestUsage.upsert({
      where: { ipHash: key },
      create: { ipHash: key, count: 1, windowEnd: new Date(now.getTime() + WINDOW_MS) },
      update: { count: 1, windowEnd: new Date(now.getTime() + WINDOW_MS) },
    });
    return 1;
  }
  const updated = await prisma.guestUsage.update({
    where: { ipHash: key },
    data: { count: { increment: 1 } },
  });
  return updated.count;
}

export async function checkGuestLimit(ip: string): Promise<GuestLimitResult> {
  const now = new Date();
  try {
    const ipCount = await bumpCounter(hashIp(ip), now);
    if (ipCount > GUEST_LIMIT) {
      return { allowed: false, remaining: 0, limit: GUEST_LIMIT, reason: 'ip' };
    }
    const globalCount = await bumpCounter(GLOBAL_KEY, now);
    if (globalCount > GUEST_GLOBAL_LIMIT) {
      return { allowed: false, remaining: 0, limit: GUEST_LIMIT, reason: 'global' };
    }
    return {
      allowed: true,
      remaining: Math.max(0, GUEST_LIMIT - ipCount),
      limit: GUEST_LIMIT,
      reason: 'ok',
    };
  } catch (error) {
    // Fail CLOSED — anonymous endpoint hitting a paid API
    console.error('Guest rate limit check failed (failing closed):', error);
    return { allowed: false, remaining: 0, limit: GUEST_LIMIT, reason: 'global' };
  }
}
