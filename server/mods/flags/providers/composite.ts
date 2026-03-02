import type { FlagContext, FlagProvider } from '../types';
import { defaults } from '../defaults';
import { EnvFlagProvider } from './env';
import { JsonFlagProvider } from './json';
import { FlagsmithProvider } from './flagsmith';
import { FeatBitProvider } from './featbit';
import type { flagsConfig } from '../../../config/flags';

type FlagsConfig = typeof flagsConfig;

// Merges all flag sources in priority order:
// defaults → json → env → remote (highest wins).
// Remote provider failure is non-fatal — falls back to lower-priority sources.
export class CompositeFlagProvider implements FlagProvider {
  private envProvider = new EnvFlagProvider();
  private jsonProvider: JsonFlagProvider | null = null;
  private remoteProvider: FlagProvider | null = null;

  constructor(private readonly config: FlagsConfig) {
    if (config.jsonPath) {
      this.jsonProvider = new JsonFlagProvider(config.jsonPath);
    }

    if (config.provider === 'flagsmith' && config.flagsmithKey) {
      this.remoteProvider = new FlagsmithProvider(config.flagsmithKey);
    } else if (config.provider === 'featbit' && config.featbitSdkKey && config.featbitUrl) {
      this.remoteProvider = new FeatBitProvider(config.featbitSdkKey, config.featbitUrl);
    }
  }

  async load(): Promise<void> {
    await this.envProvider.load();

    if (this.jsonProvider) {
      await this.jsonProvider.load();
    }

    if (this.remoteProvider) {
      try {
        await this.remoteProvider.load();
      } catch (err) {
        console.warn('[flags/composite] Remote provider failed to load, using local sources', err);
        this.remoteProvider = null;
      }
    }
  }

  async isEnabled(flagKey: string, context?: FlagContext): Promise<boolean> {
    // Remote provider takes highest priority
    if (this.remoteProvider) {
      try {
        return await this.remoteProvider.isEnabled(flagKey, context);
      } catch {
        console.warn(`[flags/composite] Remote isEnabled failed for ${flagKey}, falling back`);
      }
    }

    // Env overrides json overrides defaults
    if (this.envProvider.has(flagKey)) {
      return this.envProvider.isEnabled(flagKey, context);
    }

    if (this.jsonProvider?.has(flagKey)) {
      return this.jsonProvider.isEnabled(flagKey, context);
    }

    return defaults[flagKey] ?? false;
  }

  async getValue<T>(flagKey: string, defaultValue: T, context?: FlagContext): Promise<T> {
    if (this.remoteProvider) {
      try {
        return await this.remoteProvider.getValue(flagKey, defaultValue, context);
      } catch {
        console.warn(`[flags/composite] Remote getValue failed for ${flagKey}, falling back`);
      }
    }

    if (this.envProvider.has(flagKey)) {
      return this.envProvider.getValue(flagKey, defaultValue, context);
    }

    if (this.jsonProvider?.has(flagKey)) {
      return this.jsonProvider.getValue(flagKey, defaultValue, context);
    }

    return flagKey in defaults ? (defaults[flagKey] as unknown as T) : defaultValue;
  }
}
