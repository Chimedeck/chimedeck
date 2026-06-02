// Canonical subscription tier quota configuration.
// Single source of truth for tier entitlements and limits.
// Values: number for hard caps, 'unlimited' for unbounded resources.

export type QuotaValue = number | 'unlimited';

// Boolean feature keys — gatable premium features accessed via the feature-gate middleware.
export type BooleanFeatureKey =
  | 'automations'
  | 'webhooks'
  | 'plugins'
  | 'customFields'
  | 'apiTokens'
  | 'stateTransitions';

export type BooleanFeatures = Record<BooleanFeatureKey, boolean>;

export interface TierQuotas {
  // Board limits per workspace
  maxBoardsPerWorkspace: QuotaValue;
  maxBoardsTotal: QuotaValue;

  // List/Column limits per board
  maxColumnsPerBoard: QuotaValue;

  // Member/Guest limits per board
  maxInvitedMembersPerBoard: QuotaValue;
  maxGuestsPerBoard: QuotaValue;

  // Storage limits (in bytes)
  maxStorageBytes: QuotaValue;

  // Rate limits (requests per minute)
  readRateLimit: QuotaValue;
  writeRateLimit: QuotaValue;

  // Boolean gatable feature flags
  features: BooleanFeatures;
}

// Canonical tier IDs in ascending order (cheapest to most capable).
// Used by minimumTierFor() to find the lowest tier that unlocks a feature.
export const TIER_ORDER = ['tier_1', 'tier_2', 'unlimited'] as const;
export type CanonicalTierId = typeof TIER_ORDER[number];

export const SUBSCRIPTION_TIERS: Record<string, TierQuotas> = {
  free: {
    maxBoardsPerWorkspace: 5,
    maxBoardsTotal: 5,
    maxColumnsPerBoard: 10,
    maxInvitedMembersPerBoard: 'unlimited',
    maxGuestsPerBoard: 1,
    maxStorageBytes: 100 * 1024 * 1024, // 100 MB
    readRateLimit: 100,
    writeRateLimit: 30,
    features: {
      automations: false,
      webhooks: false,
      plugins: false,
      customFields: false,
      apiTokens: false,
      stateTransitions: false,
    },
  },
  pro: {
    maxBoardsPerWorkspace: 50,
    maxBoardsTotal: 'unlimited',
    maxColumnsPerBoard: 'unlimited',
    maxInvitedMembersPerBoard: 'unlimited',
    maxGuestsPerBoard: 10,
    maxStorageBytes: 10 * 1024 * 1024 * 1024, // 10 GB
    readRateLimit: 500,
    writeRateLimit: 200,
    features: {
      automations: true,
      webhooks: false,
      plugins: true,
      customFields: true,
      apiTokens: true,
      stateTransitions: true,
    },
  },
  enterprise: {
    maxBoardsPerWorkspace: 'unlimited',
    maxBoardsTotal: 'unlimited',
    maxColumnsPerBoard: 'unlimited',
    maxInvitedMembersPerBoard: 'unlimited',
    maxGuestsPerBoard: 'unlimited',
    maxStorageBytes: 100 * 1024 * 1024 * 1024, // 10 GB
    readRateLimit: 'unlimited',
    writeRateLimit: 'unlimited',
    features: {
      automations: true,
      webhooks: true,
      plugins: true,
      customFields: true,
      apiTokens: true,
      stateTransitions: true,
    },
  },
};

// Fallback tier when subscriptions feature is disabled
export const DEFAULT_UNLIMITED_TIER = SUBSCRIPTION_TIERS.enterprise;
