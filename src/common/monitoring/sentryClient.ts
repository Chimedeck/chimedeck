import * as Sentry from '@sentry/react';
import config from '~/config';

// tracesSampleRate of 1.0 captures every transaction — dial down in high-traffic production.
const TRACES_SAMPLE_RATE = 1.0;

/**
 * Patterns for noisy browser errors that are not actionable for this app.
 * Errors matching any pattern are dropped before reaching Sentry's servers.
 *
 * TODO: extend this list as new noise patterns are discovered in production.
 */
const IGNORED_ERROR_PATTERNS: RegExp[] = [
  // Browser ResizeObserver fires this when it cannot deliver observations in one
  // animation frame — benign, no meaningful stack trace.
  /ResizeObserver loop (limit exceeded|completed with undelivered notifications)/i,

  // Generic network failures (fetch/XHR) caused by connectivity issues outside
  // our control. We still want to keep errors with a meaningful stack.
  /^(TypeError: )?(Failed to fetch|NetworkError|Load failed|Network request failed)$/i,

  // Cross-origin script errors report no details and are not actionable.
  /^Script error\.?$/i,

  // Chunk-load failures after a deploy — the user has a stale bundle.
  // A page reload resolves it; no code fix is needed on our side.
  /ChunkLoadError/i,
  /Loading chunk \d+ failed/i,
  /Loading CSS chunk \d+ failed/i,

  // Safari private-browsing storage quota error — not our bug.
  /QuotaExceededError/i,
];

/**
 * Drop known noisy browser errors before they reach Sentry.
 * Returns null to discard the event or the event unchanged to forward it.
 */
function beforeSend(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  const message =
    event.exception?.values?.[0]?.value ?? event.message ?? '';

  if (IGNORED_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
    return null;
  }

  return event;
}

// replaysSessionSampleRate: fraction of sessions that will be replayed.
// replaysOnErrorSampleRate: always replay sessions that contain an error.
const REPLAYS_SESSION_SAMPLE_RATE = 0.1;
const REPLAYS_ON_ERROR_SAMPLE_RATE = 1.0;

/**
 * Initialize the Sentry React SDK.
 * Guards: only runs when sentryEnabled=true AND a valid DSN is configured.
 * Safe to call unconditionally at app bootstrap — it is a no-op when disabled.
 */
export function initSentry(): void {
  if (!config.sentryEnabled || !config.sentryDsn) return;

  const integrations: Parameters<typeof Sentry.init>[0]['integrations'] = [
    Sentry.browserTracingIntegration(),
  ];

  // TODO: Replay is bandwidth-intensive; consider making it a separate feature flag
  if (config.sentryReplayEnabled) {
    integrations.push(
      Sentry.replayIntegration({
        // Mask all text and block all media by default — protects PII without explicit allowlists.
        maskAllText: true,
        blockAllMedia: true,
      })
    );
  }

  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.sentryEnv,
    // Empty string → Sentry ignores the release tag rather than recording a blank value.
    ...(config.sentryRelease ? { release: config.sentryRelease } : {}),
    integrations,
    tracesSampleRate: TRACES_SAMPLE_RATE,
    replaysSessionSampleRate: REPLAYS_SESSION_SAMPLE_RATE,
    replaysOnErrorSampleRate: REPLAYS_ON_ERROR_SAMPLE_RATE,
    // Disable automatic PII collection (user IPs, request bodies).
    sendDefaultPii: false,
    beforeSend,
  });
}

/**
 * Capture an arbitrary Error or unknown value in Sentry.
 * Silently no-ops when Sentry is not initialised.
 */
export function captureError(error: unknown): void {
  Sentry.captureException(error);
}

/**
 * Capture a custom message at the given severity level.
 * Silently no-ops when Sentry is not initialised.
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info'
): void {
  Sentry.captureMessage(message, level);
}
