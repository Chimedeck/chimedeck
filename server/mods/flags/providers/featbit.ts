import type { FlagContext, FlagProvider } from '../types';

// FeatBit server SDK wrapper.
// No-op when FEATBIT_SDK_KEY is absent.
// TODO: install @featbit/node-server-sdk when enabling this provider
export class FeatBitProvider implements FlagProvider {
  private initialized = false;

  constructor(
    private readonly sdkKey: string,
    private readonly sdkUrl: string
  ) {}

  async load(): Promise<void> {
    try {
      // TODO: initialise FeatBit SDK (streaming updates)
      // const { FbClient } = require('@featbit/node-server-sdk');
      // this.client = new FbClient(this.sdkKey, { streamingUri: this.sdkUrl });
      // await this.client.waitForInitialization();
      this.initialized = true;
    } catch (err) {
      console.warn('[flags/featbit] Initialisation failed, falling back to local sources', err);
    }
  }

  async isEnabled(flagKey: string, _context?: FlagContext): Promise<boolean> {
    if (!this.initialized) return false;
    // TODO: return this.client.boolVariation(flagKey, context?.userId ?? 'anon', false)
    return false;
  }

  async getValue<T>(flagKey: string, defaultValue: T, _context?: FlagContext): Promise<T> {
    if (!this.initialized) return defaultValue;
    // TODO: return this.client.jsonVariation(flagKey, context?.userId ?? 'anon', defaultValue)
    return defaultValue;
  }
}
