import { Redis } from '@upstash/redis';

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;

const localCancellations = new Map<string, number>();
const CANCELLATION_TTL_SECONDS = 120;

function key(userId: string, generationId: string) {
  return `generation-canceled:${userId}:${generationId}`;
}

function pruneLocalCancellations() {
  const now = Date.now();
  for (const [entryKey, expiresAt] of localCancellations) {
    if (expiresAt <= now) localCancellations.delete(entryKey);
  }
}

export async function markGenerationCanceled(userId: string, generationId: string) {
  const cancellationKey = key(userId, generationId);

  if (redis) {
    await redis.set(cancellationKey, '1', { ex: CANCELLATION_TTL_SECONDS });
    return;
  }

  pruneLocalCancellations();
  localCancellations.set(cancellationKey, Date.now() + CANCELLATION_TTL_SECONDS * 1000);
}

export async function wasGenerationCanceled(userId: string, generationId: string) {
  const cancellationKey = key(userId, generationId);

  if (redis) return (await redis.get<string>(cancellationKey)) === '1';

  pruneLocalCancellations();
  return localCancellations.has(cancellationKey);
}

export async function clearGenerationCancellation(userId: string, generationId: string) {
  const cancellationKey = key(userId, generationId);
  if (redis) {
    await redis.del(cancellationKey);
    return;
  }
  localCancellations.delete(cancellationKey);
}
