// server/mods/pubsub/index.ts
// Resolves the active PubSubProvider adapter from feature flags.
import { flags } from '../flags';
import { InMemoryPubSubAdapter } from './adapters/inMemory';
import { RedisPubSubAdapter } from './adapters/redis';
import { env } from '../../config/env';
import type { PubSubProvider } from './types';

export type { PubSubProvider } from './types';

async function resolvePubSub(): Promise<PubSubProvider> {
  const useRedis = await flags.isEnabled('USE_REDIS');
  if (useRedis && env.REDIS_URL) {
    return new RedisPubSubAdapter(env.REDIS_URL);
  }
  return new InMemoryPubSubAdapter();
}

// Singleton — resolved once at module load.
export const pubsub: PubSubProvider = await resolvePubSub();
