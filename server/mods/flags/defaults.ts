// Hardcoded fallback values for all known platform flags.
// Higher-priority sources (env, json, remote) override these.
export const defaults: Record<string, boolean> = {
  USE_REDIS: true,
  USE_LOCAL_STORAGE: true,          // true = LocalStack in dev, false = AWS S3 in prod
  VIRUS_SCAN_ENABLED: true,
  OAUTH_GOOGLE_ENABLED: true,
  OAUTH_GITHUB_ENABLED: true,
  SEARCH_ENABLED: true,
  RATE_LIMIT_ENABLED: true,
  OTEL_ENABLED: true,
  BOARD_SNAPSHOT_ENABLED: true,
  EMAIL_VERIFICATION_ENABLED: false,
  SES_ENABLED: false,
  NOTIFICATION_PREFERENCES_ENABLED: true,
  EMAIL_NOTIFICATIONS_ENABLED: false,
};
