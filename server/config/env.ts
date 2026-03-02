// Single source of truth for all environment variable access.
// Never use Bun.env or process.env directly outside this module.
export const env = {
  DATABASE_URL: Bun.env['DATABASE_URL'] ?? '',
  JWT_PRIVATE_KEY: Bun.env['JWT_PRIVATE_KEY'] ?? '',
  JWT_PUBLIC_KEY: Bun.env['JWT_PUBLIC_KEY'] ?? '',

  // S3 / file storage
  // When FLAG_USE_LOCAL_STORAGE=true, the storage module overrides endpoint/credentials with LocalStack defaults.
  S3_ENDPOINT: Bun.env['S3_ENDPOINT'] ?? '',
  S3_BUCKET: Bun.env['S3_BUCKET'] ?? 'kanban',
  S3_REGION: Bun.env['S3_REGION'] ?? 'us-east-1',
  AWS_ACCESS_KEY_ID: Bun.env['AWS_ACCESS_KEY_ID'] ?? '',
  AWS_SECRET_ACCESS_KEY: Bun.env['AWS_SECRET_ACCESS_KEY'] ?? '',

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
