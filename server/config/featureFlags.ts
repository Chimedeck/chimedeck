export const featureFlags = {
  // [context] Read at access-time so runtime env toggles are reflected immediately by route guards.
  get STATE_TRANSITIONS_ENABLED() {
    return Bun.env.STATE_TRANSITIONS_ENABLED === 'true';
  },
  // [context] Master switch for workspace subscription/billing UI and gating.
  // When false, the Billing tab is hidden and subscription features resolve to the unlimited tier.
  get SUBSCRIPTIONS_ENABLED() {
    return Bun.env['SUBSCRIPTIONS_ENABLED'] === 'true';
  },
} as const;
