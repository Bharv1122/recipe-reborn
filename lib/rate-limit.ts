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

/**
 * A configured-but-unreachable Redis is worse than none at all. When the
 * Upstash database behind UPSTASH_REDIS_REST_URL was deleted, the hostname
 * stopped resolving and every call sat in a DNS timeout for ~4.5s before
 * failing open — adding 4.5s to signup and 8.9s to a password-reset request,
 * while providing no rate limiting at all.
 *
 * So: cap how long a check may take, and stop calling entirely for a while
 * after repeated failures. Rate limiting is a guard, never a dependency the
 * user waits on.
 */
const REDIS_TIMEOUT_MS = 1000;
const FAILURES_BEFORE_TRIPPING = 3;
const CIRCUIT_OPEN_MS = 60_000;

// Module scope persists across invocations on a warm serverless instance, so
// one cold instance pays at most FAILURES_BEFORE_TRIPPING slow calls per minute.
let consecutiveFailures = 0;
let circuitOpenUntil = 0;

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Redis call exceeded ${ms}ms`)), ms)
    ),
  ]);
}

function recordFailure(error: unknown): void {
  consecutiveFailures += 1;

  if (consecutiveFailures >= FAILURES_BEFORE_TRIPPING) {
    circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
    consecutiveFailures = 0;
    // Log only when the circuit trips, not on every request — a dead Redis
    // would otherwise bury every other log line.
    console.error(
      `Rate limiting DISABLED for ${CIRCUIT_OPEN_MS / 1000}s — Redis unreachable:`,
      error
    );
  }
}

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
  const allow = (): RateLimitResult => ({
    success: true,
    remaining: limit,
    limit,
    reset: windowSeconds,
  });

  // No Redis configured (e.g. local dev without Upstash) — fail open.
  if (!redis) {
    return allow();
  }

  // Redis is failing; skip it entirely rather than make every caller wait.
  if (Date.now() < circuitOpenUntil) {
    return allow();
  }

  try {
    // One timeout budget for the whole check, not per round trip — three
    // sequential calls at 1s each would still be 3s of user-facing latency.
    const result = await withTimeout(
      (async () => {
        const count = await redis.incr(key);

        if (count === 1) {
          await redis.expire(key, windowSeconds);
        }

        const ttl = await redis.ttl(key);
        return { count, ttl };
      })(),
      REDIS_TIMEOUT_MS
    );

    consecutiveFailures = 0;

    return {
      success: result.count <= limit,
      remaining: Math.max(0, limit - result.count),
      limit,
      reset: result.ttl > 0 ? result.ttl : windowSeconds,
    };
  } catch (error) {
    // If Redis fails or is too slow, fail open (allow the request).
    recordFailure(error);
    return allow();
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
