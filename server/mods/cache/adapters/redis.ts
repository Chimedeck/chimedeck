// server/mods/cache/adapters/redis.ts
// Redis-backed CacheProvider using ioredis.
import Redis from 'ioredis';
import type { CacheProvider } from '../types';

export class RedisCacheAdapter implements CacheProvider {
  private client: Redis;

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 3 });
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds !== undefined) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  async incr(key: string, ttlSeconds: number): Promise<number> {
    const val = await this.client.incr(key);
    if (val === 1) {
      await this.client.expire(key, ttlSeconds);
    }
    return val;
  }
}
