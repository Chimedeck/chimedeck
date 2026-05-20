export const featureFlags = {
  // [context] Read at access-time so runtime env toggles are reflected immediately by route guards.
  get STATE_TRANSITIONS_ENABLED() {
    return Bun.env.STATE_TRANSITIONS_ENABLED === 'true';
  },
} as const;
