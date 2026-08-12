import { Redis } from '@upstash/redis';
import { logServerError } from '@/lib/server-error-log';

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
    try {
      await redis.set(cancellationKey, '1', { ex: CANCELLATION_TTL_SECONDS });
      return;
    } catch (error) {
      logServerError('generation_cancellation_redis_write_failed', error);
    }
  }

  pruneLocalCancellations();
  localCancellations.set(cancellationKey, Date.now() + CANCELLATION_TTL_SECONDS * 1000);
}

export async function wasGenerationCanceled(userId: string, generationId: string) {
  const cancellationKey = key(userId, generationId);

  if (redis) {
    try {
      return (await redis.get<string>(cancellationKey)) === '1';
    } catch (error) {
      logServerError('generation_cancellation_redis_read_failed', error);
    }
  }

  pruneLocalCancellations();
  return localCancellations.has(cancellationKey);
}

export async function clearGenerationCancellation(userId: string, generationId: string) {
  const cancellationKey = key(userId, generationId);
  if (redis) {
    try {
      await redis.del(cancellationKey);
      return;
    } catch (error) {
      logServerError('generation_cancellation_redis_delete_failed', error);
    }
  }
  localCancellations.delete(cancellationKey);
}
