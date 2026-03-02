export interface FlagContext {
  userId?: string;
  workspaceId?: string;
  email?: string;
}

export interface FlagProvider {
  /** Return the resolved boolean value of a flag for an optional context */
  isEnabled(flagKey: string, context?: FlagContext): Promise<boolean>;
  /** Return a typed variant value (string | number | json) */
  getValue<T>(flagKey: string, defaultValue: T, context?: FlagContext): Promise<T>;
  /** Batch-load and cache all flags (call once at startup) */
  load(): Promise<void>;
}
