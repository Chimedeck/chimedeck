// server/mods/cache/types.ts
// CacheProvider interface — implemented by both Redis and node-cache adapters.
export interface CacheProvider {
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<void>;
  keys(pattern: string): Promise<string[]>;
  incr(key: string, ttlSeconds: number): Promise<number>;
}
