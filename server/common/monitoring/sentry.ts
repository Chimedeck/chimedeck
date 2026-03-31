import * as Sentry from '@sentry/node';
import { env } from '../../config/env';

/**
 * HTTP header names (lower-cased) that must never be forwarded to Sentry.
 * Covers auth tokens, session cookies, and API key headers.
 */
const SENSITIVE_HEADERS = new Set([
  'authorization', 'cookie', 'set-cookie', 'x-auth-token', 'x-api-key',
  'x-csrf-token', 'proxy-authorization',
]);

/**
 * URL query-param names that must never be forwarded to Sentry.
 */
const SENSITIVE_QUERY_PARAMS = new Set([
  'token', 'access_token', 'auth', 'api_key', 'key', 'secret',
  'password', 'passwd', 'pwd', 'code', 'state',
]);

/**
 * Top-level body field names (lower-cased) that must never be forwarded to Sentry.
 * Only shallow keys are scrubbed; nested structures should not store raw credentials.
 */
const SENSITIVE_BODY_FIELDS = new Set([
  'password', 'passwd', 'pwd', 'new_password', 'old_password',
  'token', 'secret', 'authorization',
  'credit_card', 'card_number', 'cvv', 'ssn',
]);

/**
 * Redact sensitive query-params from a URL string.
 * Returns the original string unchanged if it is not a valid URL.
 */
function redactUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.searchParams.forEach((_value, key) => {
      if (SENSITIVE_QUERY_PARAMS.has(key.toLowerCase())) {
        url.searchParams.set(key, '[redacted]');
      }
    });
    return url.toString();
  } catch {
    return raw;
  }
}

/**
 * Scrub headers, URL query-params, and body fields from a Sentry event's request context.
 * Mutates the event in-place (Sentry already owns the object at this point).
 */
function redactRequest(event: Sentry.ErrorEvent): void {
  if (!event.request) return;

  // Scrub URL query params.
  if (event.request.url) {
    event.request.url = redactUrl(event.request.url);
  }

  // Scrub headers.
  if (event.request.headers) {
    for (const key of Object.keys(event.request.headers as Record<string, string>)) {
      if (SENSITIVE_HEADERS.has(key.toLowerCase())) {
        (event.request.headers as Record<string, string>)[key] = '[redacted]';
      }
    }
  }

  // Remove raw query_string — already covered by URL redaction above.
  if (event.request.query_string) {
    delete event.request.query_string;
  }

  // Scrub top-level body fields (only when the body is a plain object).
  if (event.request.data && typeof event.request.data === 'object' && !Array.isArray(event.request.data)) {
    const body = event.request.data as Record<string, unknown>;
    for (const key of Object.keys(body)) {
      if (SENSITIVE_BODY_FIELDS.has(key.toLowerCase())) {
        body[key] = '[redacted]';
      }
    }
  }
}

/**
 * beforeSend hook: redact PII from every server-side Sentry event.
 * Never returns null — server errors are always worth capturing (unlike client noise).
 */
function beforeSend(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  redactRequest(event);
  return event;
}

/**
 * Initialize the Sentry Node SDK for Bun server-side error capture.
 * Guards: only runs when SENTRY_SERVER_ENABLED=true AND a valid DSN is provided.
 * Safe to call unconditionally at server startup — it is a no-op when disabled.
 * If DSN is missing but enabled, logs a warning and skips init rather than crashing.
 */
export function initSentry(): void {
  if (!env.SENTRY_SERVER_ENABLED) return;

  if (!env.SENTRY_SERVER_DSN) {
    console.warn('[sentry] SENTRY_SERVER_ENABLED=true but SENTRY_SERVER_DSN is not set — skipping init');
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_SERVER_DSN,
    environment: env.SENTRY_ENV,
    // Empty string → omit release tag rather than recording a blank value.
    ...(env.SENTRY_RELEASE ? { release: env.SENTRY_RELEASE } : {}),
    // Disable automatic PII collection (user IPs, request bodies) by default.
    sendDefaultPii: false,
    // tracesSampleRate of 1.0 captures every transaction — dial down in high-traffic production.
    // TODO: make this configurable via env var once usage patterns are known.
    tracesSampleRate: 1.0,
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
