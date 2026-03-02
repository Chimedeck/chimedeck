import type { FlagContext, FlagProvider } from '../types';

// Reads FLAG_<KEY>=true|false from Bun.env.
// Higher priority than defaults and json file.
export class EnvFlagProvider implements FlagProvider {
  private cache: Map<string, boolean> = new Map();

  async load(): Promise<void> {
    for (const [key, value] of Object.entries(Bun.env)) {
      if (key.startsWith('FLAG_') && value !== undefined) {
        const flagKey = key.slice(5); // strip "FLAG_" prefix
        this.cache.set(flagKey, value.toLowerCase() === 'true');
      }
    }
  }

  async isEnabled(flagKey: string, _context?: FlagContext): Promise<boolean> {
    return this.cache.get(flagKey) ?? false;
  }

  async getValue<T>(flagKey: string, defaultValue: T, _context?: FlagContext): Promise<T> {
    const val = this.cache.get(flagKey);
    return val !== undefined ? (val as unknown as T) : defaultValue;
  }

  has(flagKey: string): boolean {
    return this.cache.has(flagKey);
  }
}
