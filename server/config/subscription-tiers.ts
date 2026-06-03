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
  // Workspace limits per account (owner-level)
  maxWorkspaces: QuotaValue;

  // Board limits per workspace
  maxBoardsPerWorkspace: QuotaValue;
  maxBoardsTotal: QuotaValue;

  // List/Column limits per board
  maxColumnsPerBoard: QuotaValue;

  // Card limits per board
  maxCardsPerBoard: QuotaValue;

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
export const TIER_ORDER = ['tier_1', 'tier_2', 'tier_3', 'tier_4', 'unlimited'] as const;
export type CanonicalTierId = typeof TIER_ORDER[number];

export const SUBSCRIPTION_TIERS: Record<string, TierQuotas> = {
  // Personal — free tier
  personal: {
    maxWorkspaces: 1,
    maxBoardsPerWorkspace: 1,
    maxBoardsTotal: 1,
    maxColumnsPerBoard: 10,
    maxCardsPerBoard: 500,
    maxInvitedMembersPerBoard: 'unlimited',
    maxGuestsPerBoard: 'unlimited',
    maxStorageBytes: 10 * 1024 * 1024, // 10 MB
    readRateLimit: 500,
    writeRateLimit: 200,
    features: {
      automations: false,
      webhooks: false,
      plugins: false,
      customFields: false,
      apiTokens: false,
      stateTransitions: false,
    },
  },

  // Hobby — $49/month
  hobby: {
    maxWorkspaces: 1,
    maxBoardsPerWorkspace: 10,
    maxBoardsTotal: 10,
    maxColumnsPerBoard: 10,
    maxCardsPerBoard: 500,
    maxInvitedMembersPerBoard: 'unlimited',
    maxGuestsPerBoard: 'unlimited',
    maxStorageBytes: 5 * 1024 * 1024 * 1024, // 5 GB
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

  // Pro — $99/month
  pro: {
    maxWorkspaces: 5,
    maxBoardsPerWorkspace: 30,
    maxBoardsTotal: 150,
    maxColumnsPerBoard: 10,
    maxCardsPerBoard: 1000,
    maxInvitedMembersPerBoard: 'unlimited',
    maxGuestsPerBoard: 'unlimited',
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

  // Business — $400/month
  business: {
    maxWorkspaces: 50,
    maxBoardsPerWorkspace: 200,
    maxBoardsTotal: 'unlimited',
    maxColumnsPerBoard: 20,
    maxCardsPerBoard: 5000,
    maxInvitedMembersPerBoard: 'unlimited',
    maxGuestsPerBoard: 'unlimited',
    maxStorageBytes: 100 * 1024 * 1024 * 1024, // 100 GB
    readRateLimit: 3000,
    writeRateLimit: 1000,
    features: {
      automations: true,
      webhooks: true,
      plugins: true,
      customFields: true,
      apiTokens: true,
      stateTransitions: true,
    },
  },

  // Enterprise — internal fallback (not purchasable via checkout)
  enterprise: {
    maxWorkspaces: 'unlimited',
    maxBoardsPerWorkspace: 'unlimited',
    maxBoardsTotal: 'unlimited',
    maxColumnsPerBoard: 'unlimited',
    maxCardsPerBoard: 'unlimited',
    maxInvitedMembersPerBoard: 'unlimited',
    maxGuestsPerBoard: 'unlimited',
    maxStorageBytes: 'unlimited',
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
