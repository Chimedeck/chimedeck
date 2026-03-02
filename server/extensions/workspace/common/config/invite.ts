// Centralised invite configuration.
// All invite-related constants are sourced from here — never inline magic numbers.

// Default invite TTL: 48 hours in seconds.
const DEFAULT_INVITE_TTL_SECONDS = 48 * 60 * 60;

export const inviteConfig = {
  // How long (in seconds) an invite token remains valid.
  ttlSeconds: parseInt(Bun.env['INVITE_TTL_SECONDS'] ?? String(DEFAULT_INVITE_TTL_SECONDS), 10),
  // Redis / memcache key prefix for fast-path lookups.
  cacheKeyPrefix: 'invite:',
} as const;
