import { Redis } from '@upstash/redis';

export interface PluginStore {
  get<T>(key: string): Promise<T | null>;
  put(key: string, value: unknown, seconds: number): Promise<void>;
  take<T>(key: string): Promise<T | null>;
  remove(key: string): Promise<void>;
  limit(key: string, maximum: number, seconds: number): Promise<boolean>;
}

/** Fail closed: grants and one-use consent must survive server instances. */
export function productionStore(): PluginStore {
  const url = process.env.PLUGIN_REDIS_REST_URL;
  const token = process.env.PLUGIN_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Plugin secure storage is not configured');
  const redis = new Redis({ url, token, retry: { retries: 0 } });
  const key = (value: string) => `recipe-plugin:v1:${value}`;
  return {
    get: <T>(value: string) => redis.get<T>(key(value)),
    put: async (value, data, seconds) => { await redis.set(key(value), data, { ex: seconds }); },
    take: <T>(value: string) => redis.getdel<T>(key(value)),
    remove: async value => { await redis.del(key(value)); },
    limit: async (value, max, seconds) => {
      const count = await redis.eval(
        'local n=redis.call("INCR",KEYS[1]); if n==1 then redis.call("EXPIRE",KEYS[1],ARGV[1]) end; return n',
        [key(`limit:${value}`)], [seconds]);
      if (typeof count !== 'number') throw new Error('Invalid plugin rate-limit response');
      return count <= max;
    },
  };
}
