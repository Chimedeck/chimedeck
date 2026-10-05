// Centralised frontend config for the Board Chat feature.
// All tunable constants and feature flags live here so they are easy to find.

/**
 * Feature flag — whether Board Chat is enabled and should be shown in the header.
 * Runtime truth comes from the server via /api/v1/flags (FLAG_BOARD_CHAT_ENABLED).
 * Build-time fallback uses import.meta.env.FLAG_BOARD_CHAT_ENABLED or the
 * window.__BOARD_CHAT_ENABLED__ injection.
 * Set to false by default; the app should override this from the server config.
 */
export const BOARD_CHAT_ENABLED =
  (typeof window !== 'undefined' &&
    (window as unknown as Record<string, unknown>).__BOARD_CHAT_ENABLED__ === true) ||
  import.meta.env.FLAG_BOARD_CHAT_ENABLED === 'true';
