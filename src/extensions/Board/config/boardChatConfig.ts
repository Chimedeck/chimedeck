// Centralised frontend config for the Board Chat feature.
// All tunable constants and feature flags live here so they are easy to find.

/**
 * Feature flag — whether Board Chat is enabled and should be shown in the header.
 * Mirrors the BOARD_CHAT_ENABLED server env var exposed via /api/v1/config
 * or an injected window variable.
 * Set to false by default; the app should override this from the server config.
 */
export const BOARD_CHAT_ENABLED =
  (typeof window !== 'undefined' &&
    (window as unknown as Record<string, unknown>).__BOARD_CHAT_ENABLED__ === true) ||
  import.meta.env.VITE_BOARD_CHAT_ENABLED === 'true';
