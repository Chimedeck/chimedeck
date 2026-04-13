// Central config for all client-side environment variables.
// Access via import config from '~/config'; never use import.meta.env directly.
const config = {
  /** Maximum upload size in bytes. Mirrors MAX_ATTACHMENT_SIZE_MB on the server. Default: 50 MB. */
  maxAttachmentSizeBytes:
    parseInt(import.meta.env['VITE_MAX_ATTACHMENT_SIZE_MB'] ?? '50', 10) * 1024 * 1024,
  /** Public base URL of this ChimeDeck instance, e.g. https://app.example.com */
  appUrl: (import.meta.env['VITE_APP_URL'] as string | undefined) ?? '',
  /** Set VITE_OAUTH_GOOGLE_ENABLED=true when OAUTH_GOOGLE_CLIENT_ID/SECRET are configured. */
  oauthGoogleEnabled: import.meta.env['VITE_OAUTH_GOOGLE_ENABLED'] === 'true',
  /** Set VITE_OAUTH_GITHUB_ENABLED=true when OAUTH_GITHUB_CLIENT_ID/SECRET are configured. */
  oauthGithubEnabled: import.meta.env['VITE_OAUTH_GITHUB_ENABLED'] === 'true',
  /** When true, the app is open for self-service signup (public SaaS).
   *  When false, signup is invite-only / internal — the login page shows
   *  "Belongs to our company? Sign up" instead of the generic prompt. */
  allowPublicAccess: import.meta.env['VITE_ALLOW_PUBLIC_ACCESS'] === 'true',

  // Sentry client-side monitoring
  /** Set VITE_SENTRY_CLIENT_ENABLED=true and provide VITE_SENTRY_CLIENT_DSN to activate capture. */
  sentryEnabled: import.meta.env['VITE_SENTRY_CLIENT_ENABLED'] === 'true',
  /** Sentry DSN for the React client. An empty string disables Sentry even when sentryEnabled=true. */
  sentryDsn: (import.meta.env['VITE_SENTRY_CLIENT_DSN'] as string | undefined) ?? '',
  /** Deployment environment tag sent to Sentry (e.g. "production", "staging", "development"). */
  sentryEnv: (import.meta.env['VITE_SENTRY_ENV'] as string | undefined) ?? 'development',
  /** Release identifier sent to Sentry, typically a git SHA or semver tag. */
  sentryRelease: (import.meta.env['VITE_SENTRY_RELEASE'] as string | undefined) ?? '',
  /** Set VITE_SENTRY_REPLAY_ENABLED=true to activate Session Replay (bandwidth-intensive). */
  sentryReplayEnabled: import.meta.env['VITE_SENTRY_REPLAY_ENABLED'] === 'true',
};

export default config;
