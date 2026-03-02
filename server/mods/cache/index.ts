// In-memory cache with TTL using node-cache.
// Used for OAuth state nonces and rate-limiting counters when USE_REDIS=false.
// This module is the local-dev fallback; a Redis adapter will be wired in sprint 09.
import NodeCache from 'node-cache';

const cache = new NodeCache({ checkperiod: 60 });

export const memCache = {
  /** Store a value with an optional TTL in seconds. */
  set(key: string, value: string, ttlSeconds?: number): void {
    if (ttlSeconds !== undefined) {
      cache.set(key, value, ttlSeconds);
    } else {
      cache.set(key, value);
    }
  },

  get(key: string): string | null {
    return cache.get<string>(key) ?? null;
  },

  del(key: string): void {
    cache.del(key);
  },

  /** Increment an integer counter, setting TTL only on first write. Returns new value. */
  incr(key: string, ttlSeconds: number): number {
    const current = cache.get<number>(key);
    if (current === undefined) {
      cache.set(key, 1, ttlSeconds);
      return 1;
    }
    const next = current + 1;
    // Preserve remaining TTL by not resetting it.
    cache.set(key, next, cache.getTtl(key) ? Math.round((cache.getTtl(key)! - Date.now()) / 1000) : ttlSeconds);
    return next;
  },
};
