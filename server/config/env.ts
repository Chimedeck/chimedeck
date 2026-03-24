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
  // S3-specific credentials — use these to point S3/LocalStack at a different IAM identity
  // than the global AWS credentials (e.g. real SES + LocalStack S3 in the same environment).
  // When unset, fall back to the global AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY.
  S3_AWS_ACCESS_KEY_ID: Bun.env['S3_AWS_ACCESS_KEY_ID'] ?? '',
  S3_AWS_SECRET_ACCESS_KEY: Bun.env['S3_AWS_SECRET_ACCESS_KEY'] ?? '',
  // Global AWS credentials — used by SES and as fallback for S3.
  AWS_ACCESS_KEY_ID: Bun.env['AWS_ACCESS_KEY_ID'] ?? '',
  AWS_SECRET_ACCESS_KEY: Bun.env['AWS_SECRET_ACCESS_KEY'] ?? '',

  APP_PORT: parseInt(Bun.env['APP_PORT'] ?? '3000', 10),
  APP_URL: Bun.env['VITE_APP_URL'] ?? 'http://localhost:3000',
  // Base URL used by the CSRF origin guard to validate incoming Origin/Referer headers.
  // Falls back to APP_URL so existing deployments work without extra config.
  APP_BASE_URL: Bun.env['APP_BASE_URL'] ?? Bun.env['APP_URL'] ?? 'http://localhost:3000',
  // Optional comma-separated list of additional trusted origins for the CSRF guard.
  // Useful when a reverse proxy or CDN presents a different origin than APP_BASE_URL.
  // Note: localhost-to-localhost requests are automatically trusted (dev proxy support).
  CSRF_ALLOWED_ORIGINS: Bun.env['CSRF_ALLOWED_ORIGINS'] ?? '',

  // OAuth providers
  OAUTH_GOOGLE_CLIENT_ID: Bun.env['OAUTH_GOOGLE_CLIENT_ID'] ?? '',
  OAUTH_GOOGLE_CLIENT_SECRET: Bun.env['OAUTH_GOOGLE_CLIENT_SECRET'] ?? '',
  OAUTH_GITHUB_CLIENT_ID: Bun.env['OAUTH_GITHUB_CLIENT_ID'] ?? '',
  OAUTH_GITHUB_CLIENT_SECRET: Bun.env['OAUTH_GITHUB_CLIENT_SECRET'] ?? '',

  // Optional — omit to run without Redis
  REDIS_URL: Bun.env['REDIS_URL'] ?? undefined,

  // Attachment uploads
  /** Maximum single-file upload size in MB. Default: 250. */
  MAX_ATTACHMENT_SIZE_MB: Number.parseInt(Bun.env['MAX_ATTACHMENT_SIZE_MB'] ?? '250', 10),

  // Feature gates
  VIRUS_SCAN_ENABLED: Bun.env['VIRUS_SCAN_ENABLED'] === 'true',
  VIRUS_SCAN_API_KEY: Bun.env['VIRUS_SCAN_API_KEY'] ?? '',

  // Search feature gate — when false, GET /search returns 501
  SEARCH_ENABLED: Bun.env['SEARCH_ENABLED'] === 'true',

  // OpenTelemetry — when false, no SDK is initialised and spans are no-ops
  OTEL_ENABLED: Bun.env['OTEL_ENABLED'] === 'true',
  OTEL_EXPORTER_URL: Bun.env['OTEL_EXPORTER_URL'] ?? 'http://localhost:4318/v1/traces',
  OTEL_EXPORTER_OTLP_ENDPOINT: Bun.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://localhost:4318',
  OTEL_SERVICE_NAME: Bun.env['OTEL_SERVICE_NAME'] ?? 'kanban-server',

  // Rate-limiting — when false, all limits are bypassed
  RATE_LIMIT_ENABLED: Bun.env['RATE_LIMIT_ENABLED'] === 'true',

  // Email / SES
  SES_REGION: Bun.env['SES_REGION'] ?? 'us-east-1',
  SES_FROM_ADDRESS: Bun.env['SES_FROM_ADDRESS'] ?? 'noreply@example.com',

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

  // Access token TTL in seconds. Defaults to 24 hours (production-safe).
  // Override with ACCESS_TOKEN_TTL_SECONDS env var (e.g. set to 900 for tighter session windows).
  ACCESS_TOKEN_TTL_SECONDS: parseInt(Bun.env['ACCESS_TOKEN_TTL_SECONDS'] ?? String(24 * 60 * 60), 10),

  // Platform admin emails — comma-separated list of emails allowed to manage the plugin registry.
  // Fail safe: deny all if not set.
  PLATFORM_ADMIN_EMAILS: Bun.env['PLATFORM_ADMIN_EMAILS'] ?? '',

  // Email domain restriction — controls which email domains may register or change their email.
  // Comma-separated list of allowed domains. Defaults to "journeyh.io" when not set.
  // Example: "journeyh.io,partner.com"
  ALLOWED_EMAIL_DOMAINS: Bun.env['ALLOWED_EMAIL_DOMAINS'] ?? 'journeyh.io',
  // When true, registration and email-change are restricted to ALLOWED_EMAIL_DOMAINS.
  // Set to "false" to disable the restriction entirely.
  EMAIL_DOMAIN_RESTRICTION_ENABLED: Bun.env['EMAIL_DOMAIN_RESTRICTION_ENABLED'] !== 'false',

  // Comma-separated list of email domains whose users may create accounts on behalf of others.
  // Intentionally separate from ALLOWED_EMAIL_DOMAINS (self-registration allowlist).
  // Falls back to "journeyh.io" when not set.
  ADMIN_EMAIL_DOMAINS: Bun.env['ADMIN_EMAIL_DOMAINS'] ?? 'journeyh.io',

  // Controls invitation emails for admin-created accounts specifically.
  // SES_ENABLED must ALSO be true — this flag exists so operators can run SES
  // for other flows (e.g. email verification, password reset) without
  // automatically enabling admin invite emails.
  ADMIN_INVITE_EMAIL_ENABLED: Bun.env['ADMIN_INVITE_EMAIL_ENABLED'] === 'true',

  // Notification preferences — when false, GET/PATCH /preferences return 501
  // and all channels remain enabled for all users.
  NOTIFICATION_PREFERENCES_ENABLED: Bun.env['NOTIFICATION_PREFERENCES_ENABLED'] !== 'false',

  // Email notifications — both SES_ENABLED and this flag must be true for notification emails to send.
  EMAIL_NOTIFICATIONS_ENABLED: Bun.env['EMAIL_NOTIFICATIONS_ENABLED'] === 'true',
} as const;
