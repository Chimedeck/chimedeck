import type { FlagContext, FlagProvider } from '../types';

// Flagsmith server-side SDK wrapper.
// No-op when FLAGSMITH_SERVER_KEY is absent.
// TODO: install flagsmith-nodejs SDK when enabling this provider
export class FlagsmithProvider implements FlagProvider {
  private initialized = false;

  constructor(private readonly apiKey: string) {}

  async load(): Promise<void> {
    try {
      // TODO: initialise Flagsmith SDK with this.apiKey (poll interval 60 s)
      // const flagsmith = require('flagsmith-nodejs');
      // await flagsmith.init({ environmentKey: this.apiKey, enableAnalytics: false });
      this.initialized = true;
    } catch (err) {
      console.warn('[flags/flagsmith] Initialisation failed, falling back to local sources', err);
    }
  }

  async isEnabled(flagKey: string, _context?: FlagContext): Promise<boolean> {
    if (!this.initialized) return false;
    // TODO: return flagsmith.hasFeature(flagKey)
    return false;
  }

  async getValue<T>(flagKey: string, defaultValue: T, _context?: FlagContext): Promise<T> {
    if (!this.initialized) return defaultValue;
    // TODO: return flagsmith.getValue(flagKey) ?? defaultValue
    return defaultValue;
  }
}
