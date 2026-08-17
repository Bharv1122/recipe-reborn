import { Redis } from '@upstash/redis';

const redisUrl =
  process.env.UPSTASH_REDIS_REST_KV_REST_API_URL ??
  process.env.UPSTASH_REDIS_REST_URL;
const redisToken =
  process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN ??
  process.env.UPSTASH_REDIS_REST_TOKEN;

const redis =
  redisUrl && redisToken
    ? new Redis({ url: redisUrl, token: redisToken })
    : null;

const localCancellations = new Map<string, number>();
const CANCELLATION_TTL_SECONDS = 120;
const REDIS_TIMEOUT_MS = 1000;
const FAILURES_BEFORE_TRIPPING = 3;
const CIRCUIT_OPEN_MS = 60_000;

let consecutiveFailures = 0;
let circuitOpenUntil = 0;

function key(userId: string, generationId: string) {
  return `generation-canceled:${userId}:${generationId}`;
}

function pruneLocalCancellations() {
  const now = Date.now();
  for (const [entryKey, expiresAt] of localCancellations) {
    if (expiresAt <= now) localCancellations.delete(entryKey);
  }
}

function withTimeout<T>(work: Promise<T>): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Redis cancellation check timed out')), REDIS_TIMEOUT_MS)
    ),
  ]);
}

async function useRedis<T>(work: () => Promise<T>): Promise<T | undefined> {
  if (!redis || Date.now() < circuitOpenUntil) return undefined;

  try {
    const result = await withTimeout(work());
    consecutiveFailures = 0;
    return result;
  } catch (error) {
    consecutiveFailures += 1;
    if (consecutiveFailures >= FAILURES_BEFORE_TRIPPING) {
      circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
      consecutiveFailures = 0;
      console.error(`Generation cancellation storage disabled for ${CIRCUIT_OPEN_MS / 1000}s:`, error);
    }
    return undefined;
  }
}

export async function markGenerationCanceled(userId: string, generationId: string) {
  const cancellationKey = key(userId, generationId);

  const stored = await useRedis(() =>
    redis!.set(cancellationKey, '1', { ex: CANCELLATION_TTL_SECONDS })
  );
  if (stored !== undefined) return;

  pruneLocalCancellations();
  localCancellations.set(cancellationKey, Date.now() + CANCELLATION_TTL_SECONDS * 1000);
}

export async function wasGenerationCanceled(userId: string, generationId: string) {
  const cancellationKey = key(userId, generationId);

  const canceled = await useRedis(() => redis!.get<string>(cancellationKey));
  if (canceled !== undefined) return canceled === '1';

  pruneLocalCancellations();
  return localCancellations.has(cancellationKey);
}

export async function clearGenerationCancellation(userId: string, generationId: string) {
  const cancellationKey = key(userId, generationId);
  const cleared = await useRedis(() => redis!.del(cancellationKey));
  if (cleared !== undefined) return;
  localCancellations.delete(cancellationKey);
}
