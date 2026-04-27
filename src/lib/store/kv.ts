import { Redis } from '@upstash/redis';

let client: Redis | null = null;

export function kv(): Redis {
  if (client) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in the environment.',
    );
  }
  client = new Redis({ url, token });
  return client;
}

export function resetKvForTests(): void {
  client = null;
}
