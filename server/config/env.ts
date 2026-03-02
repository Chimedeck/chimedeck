// Single source of truth for all environment variable access.
// Never use Bun.env or process.env directly outside this module.

// JWT keys are stored as base64 in .env to avoid multiline quoting issues.
// If the value looks like raw PEM already (starts with -----), use it as-is.
function decodeKey(raw: string): string {
  if (!raw) return '';
  if (raw.startsWith('-----')) return raw;
  // base64-encoded PEM
  return Buffer.from(raw, 'base64').toString('utf-8');
}

export const env = {
  DATABASE_URL: Bun.env['DATABASE_URL'] ?? '',
  JWT_PRIVATE_KEY: decodeKey(Bun.env['JWT_PRIVATE_KEY'] ?? ''),
  JWT_PUBLIC_KEY: decodeKey(Bun.env['JWT_PUBLIC_KEY'] ?? ''),

  // S3 / file storage
  // When FLAG_USE_LOCAL_STORAGE=true, the storage module overrides endpoint/credentials with LocalStack defaults.
  S3_ENDPOINT: Bun.env['S3_ENDPOINT'] ?? '',
  S3_BUCKET: Bun.env['S3_BUCKET'] ?? 'kanban',
  S3_REGION: Bun.env['S3_REGION'] ?? 'us-east-1',
  AWS_ACCESS_KEY_ID: Bun.env['AWS_ACCESS_KEY_ID'] ?? '',
  AWS_SECRET_ACCESS_KEY: Bun.env['AWS_SECRET_ACCESS_KEY'] ?? '',

  APP_PORT: parseInt(Bun.env['APP_PORT'] ?? '3000', 10),
  APP_URL: Bun.env['APP_URL'] ?? 'http://localhost:3000',

  // OAuth providers
  OAUTH_GOOGLE_CLIENT_ID: Bun.env['OAUTH_GOOGLE_CLIENT_ID'] ?? '',
  OAUTH_GOOGLE_CLIENT_SECRET: Bun.env['OAUTH_GOOGLE_CLIENT_SECRET'] ?? '',
  OAUTH_GITHUB_CLIENT_ID: Bun.env['OAUTH_GITHUB_CLIENT_ID'] ?? '',
  OAUTH_GITHUB_CLIENT_SECRET: Bun.env['OAUTH_GITHUB_CLIENT_SECRET'] ?? '',

  // Optional — omit to run without Redis
  REDIS_URL: Bun.env['REDIS_URL'] ?? undefined,

  // Feature gates
  VIRUS_SCAN_ENABLED: Bun.env['VIRUS_SCAN_ENABLED'] === 'true',
  VIRUS_SCAN_API_KEY: Bun.env['VIRUS_SCAN_API_KEY'] ?? '',

  // Search feature gate — when false, GET /search returns 501
  SEARCH_ENABLED: Bun.env['SEARCH_ENABLED'] === 'true',

  // OpenTelemetry — when false, no SDK is initialised and spans are no-ops
  OTEL_ENABLED: Bun.env['OTEL_ENABLED'] === 'true',
  OTEL_EXPORTER_URL: Bun.env['OTEL_EXPORTER_URL'] ?? 'http://localhost:4318/v1/traces',

  // Rate-limiting — when false, all limits are bypassed
  RATE_LIMIT_ENABLED: Bun.env['RATE_LIMIT_ENABLED'] === 'true',

  // Feature flag provider configuration
  FEATURE_FLAGS_PROVIDER: Bun.env['FEATURE_FLAGS_PROVIDER'] as
    | 'flagsmith'
    | 'featbit'
    | 'local'
    | undefined,
  FLAGSMITH_SERVER_KEY: Bun.env['FLAGSMITH_SERVER_KEY'] ?? undefined,
  FEATBIT_SDK_KEY: Bun.env['FEATBIT_SDK_KEY'] ?? undefined,
  FEATBIT_URL: Bun.env['FEATBIT_URL'] ?? undefined,
  FEATURE_FLAGS_JSON_PATH: Bun.env['FEATURE_FLAGS_JSON_PATH'] ?? undefined,
} as const;
