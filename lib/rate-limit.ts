import { Redis } from "@upstash/redis";

/**
 * Simple rate limiter using Upstash Redis.
 * Uses a sliding window approach via INCR + EXPIRE.
 */

// Redis.fromEnv() throws when the Upstash env vars are missing, so guard the
// init — without Redis configured, rateLimit() must fail open, not crash.
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  limit: number;
  reset: number; // seconds until reset
}

/**
 * Check rate limit for a given identifier (IP, userId, etc.)
 * @param identifier - Unique key (IP address or user ID)
 * @param limit - Max requests allowed in window
 * @param windowSeconds - Window duration in seconds
 */
export async function rateLimit(
  identifier: string,
  limit = 10,
  windowSeconds = 60
): Promise<RateLimitResult> {
  const key = `ratelimit:${identifier}`;

  // No Redis configured (e.g. local dev without Upstash) — fail open.
  if (!redis) {
    return { success: true, remaining: limit, limit, reset: windowSeconds };
  }

  try {
    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }

    const ttl = await redis.ttl(key);

    return {
      success: count <= limit,
      remaining: Math.max(0, limit - count),
      limit,
      reset: ttl > 0 ? ttl : windowSeconds,
    };
  } catch (error) {
    // If Redis fails, fail open (allow the request) but log
    console.error("Rate limit check failed:", error);
    return { success: true, remaining: limit, limit, reset: windowSeconds };
  }
}

/**
 * Get client IP from request headers.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}
