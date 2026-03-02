// server/mods/cache/adapters/nodeCache.ts
// In-process cache adapter backed by node-cache. Also exports the legacy sync memCache
// interface used by auth/invite code from earlier sprints.
import NodeCache from 'node-cache';
import type { CacheProvider } from '../types';

const _cache = new NodeCache({ checkperiod: 60 });

// Legacy synchronous API — backward-compatible with sprint 03-08 code.
export const memCache = {
  set(key: string, value: string, ttlSeconds?: number): void {
    if (ttlSeconds !== undefined) {
      _cache.set(key, value, ttlSeconds);
    } else {
      _cache.set(key, value);
    }
  },
  get(key: string): string | null {
    return _cache.get<string>(key) ?? null;
  },
  del(key: string): void {
    _cache.del(key);
  },
  incr(key: string, ttlSeconds: number): number {
    const current = _cache.get<number>(key);
    if (current === undefined) {
      _cache.set(key, 1, ttlSeconds);
      return 1;
    }
    const next = current + 1;
    const ttlMs = _cache.getTtl(key);
    const remainSec = ttlMs ? Math.round((ttlMs - Date.now()) / 1000) : ttlSeconds;
    _cache.set(key, next, remainSec > 0 ? remainSec : ttlSeconds);
    return next;
  },
};

// Async CacheProvider implementation.
export class NodeCacheAdapter implements CacheProvider {
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds !== undefined) {
      _cache.set(key, value, ttlSeconds);
    } else {
      _cache.set(key, value);
    }
  }
  async get(key: string): Promise<string | null> {
    return _cache.get<string>(key) ?? null;
  }
  async del(key: string): Promise<void> {
    _cache.del(key);
  }
  async keys(pattern: string): Promise<string[]> {
    const all = _cache.keys();
    const regex = globToRegex(pattern);
    return all.filter((k) => regex.test(k));
  }
  async incr(key: string, ttlSeconds: number): Promise<number> {
    return memCache.incr(key, ttlSeconds);
  }
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}
