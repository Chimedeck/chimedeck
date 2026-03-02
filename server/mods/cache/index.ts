// server/mods/cache/index.ts
// Resolves the active CacheProvider adapter based on feature flags.
// Also re-exports legacy memCache for backward compatibility with earlier sprints.
import { flags } from '../flags';
import { NodeCacheAdapter, memCache } from './adapters/nodeCache';
import { RedisCacheAdapter } from './adapters/redis';
import { env } from '../../config/env';
import type { CacheProvider } from './types';

export { memCache } from './adapters/nodeCache';
export type { CacheProvider } from './types';

async function resolveCache(): Promise<CacheProvider> {
  const useRedis = await flags.isEnabled('USE_REDIS');
  if (useRedis && env.REDIS_URL) {
    return new RedisCacheAdapter(env.REDIS_URL);
  }
  return new NodeCacheAdapter();
}

// Singleton — resolved once at module load.
export const cache: CacheProvider = await resolveCache();
