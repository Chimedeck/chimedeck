import type { FlagContext, FlagProvider } from '../types';

// Parses a JSON file at FEATURE_FLAGS_JSON_PATH.
// File format: { "USE_REDIS": false, "VIRUS_SCAN_ENABLED": false }
// Hot-reloaded every 30 s in dev mode.
export class JsonFlagProvider implements FlagProvider {
  private cache: Record<string, unknown> = {};
  private reloadInterval?: ReturnType<typeof setInterval>;

  constructor(private readonly filePath: string) {}

  async load(): Promise<void> {
    await this.readFile();
    // Hot-reload every 30 s so changes take effect without restart
    this.reloadInterval = setInterval(() => {
      void this.readFile();
    }, 30_000);
  }

  private async readFile(): Promise<void> {
    try {
      const file = Bun.file(this.filePath);
      const text = await file.text();
      this.cache = JSON.parse(text) as Record<string, unknown>;
    } catch {
      console.warn(`[flags/json] Failed to read flags file: ${this.filePath}`);
    }
  }

  async isEnabled(flagKey: string, _context?: FlagContext): Promise<boolean> {
    const val = this.cache[flagKey];
    return typeof val === 'boolean' ? val : false;
  }

  async getValue<T>(flagKey: string, defaultValue: T, _context?: FlagContext): Promise<T> {
    const val = this.cache[flagKey];
    return val !== undefined ? (val as T) : defaultValue;
  }

  has(flagKey: string): boolean {
    return flagKey in this.cache;
  }

  stop(): void {
    if (this.reloadInterval) clearInterval(this.reloadInterval);
  }
}
