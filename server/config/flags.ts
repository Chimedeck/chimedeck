import { env } from './env';

// Wires Bun.env vars into the flags configuration.
// Imported by server/mods/flags/index.ts at startup.
export const flagsConfig = {
  provider: env.FEATURE_FLAGS_PROVIDER,
  flagsmithKey: env.FLAGSMITH_SERVER_KEY,
  featbitSdkKey: env.FEATBIT_SDK_KEY,
  featbitUrl: env.FEATBIT_URL,
  jsonPath: env.FEATURE_FLAGS_JSON_PATH,
} as const;
