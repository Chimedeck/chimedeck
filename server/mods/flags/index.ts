import { flagsConfig } from '../../config/flags';
import { CompositeFlagProvider } from './providers/composite';
import type { FlagContext } from './types';

// Singleton flags object — available synchronously via cached values after load().
// Usage: import { flags } from '../mods/flags';
const composite = new CompositeFlagProvider(flagsConfig);

export const flags = {
  /** Load and cache all flag sources. Call once at app startup. */
  load: () => composite.load(),

  /** Returns the resolved boolean value for a flag key. */
  isEnabled: (flagKey: string, context?: FlagContext): Promise<boolean> =>
    composite.isEnabled(flagKey, context),

  /** Returns a typed variant value (boolean | string | number | object). */
  getValue: <T>(flagKey: string, defaultValue: T, context?: FlagContext): Promise<T> =>
    composite.getValue(flagKey, defaultValue, context),
};
