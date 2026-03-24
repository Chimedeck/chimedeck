// Centralised frontend config for the Health Check feature.
// All tunable constants and feature flags live here so they are easy to find.

/** Auto-refresh interval in milliseconds. */
export const HEALTH_CHECK_POLL_INTERVAL_MS = 60_000;

/** Millisecond threshold above which a green probe is downgraded to amber. */
export const HEALTH_CHECK_AMBER_THRESHOLD_MS = 2_000;

/**
 * Feature flag — mirrors the HEALTH_CHECK_ENABLED server env var exposed
 * via /api/v1/config or an injected window variable.
 * Set to true by default; the app should override this from the server config.
 */
export const HEALTH_CHECK_ENABLED =
  (typeof window !== 'undefined' &&
    (window as unknown as Record<string, unknown>).__HEALTH_CHECK_ENABLED__ === true) ||
  import.meta.env.VITE_HEALTH_CHECK_ENABLED === 'true';
