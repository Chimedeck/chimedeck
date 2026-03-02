// Single source of truth for all environment variable access.
// Never use Bun.env or process.env directly outside this module.
export const env = {
  DATABASE_URL: Bun.env['DATABASE_URL'] ?? '',
  JWT_PRIVATE_KEY: Bun.env['JWT_PRIVATE_KEY'] ?? '',
  JWT_PUBLIC_KEY: Bun.env['JWT_PUBLIC_KEY'] ?? '',

  S3_ENDPOINT: Bun.env['S3_ENDPOINT'] ?? 'http://localhost:9000',
  S3_BUCKET: Bun.env['S3_BUCKET'] ?? 'kanban',
  S3_REGION: Bun.env['S3_REGION'] ?? 'us-east-1',
  S3_ACCESS_KEY: Bun.env['S3_ACCESS_KEY'] ?? '',
  S3_SECRET_KEY: Bun.env['S3_SECRET_KEY'] ?? '',

  APP_PORT: parseInt(Bun.env['APP_PORT'] ?? '3000', 10),

  // Optional — omit to run without Redis
  REDIS_URL: Bun.env['REDIS_URL'] ?? undefined,

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
