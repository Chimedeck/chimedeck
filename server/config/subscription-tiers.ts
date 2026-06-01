// Canonical subscription tier quota configuration.
// Single source of truth for tier entitlements and limits.
// Values: number for hard caps, 'unlimited' for unbounded resources.

export type QuotaValue = number | 'unlimited';

export interface TierQuotas {
  // Workspace limits
  maxWorkspaces: QuotaValue;

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
}

export const SUBSCRIPTION_TIERS: Record<string, TierQuotas> = {
  free: {
    maxWorkspaces: 1,
    maxBoardsPerWorkspace: 5,
    maxBoardsTotal: 5,
    maxColumnsPerBoard: 10,
    maxInvitedMembersPerBoard: 2,
    maxGuestsPerBoard: 1,
    maxStorageBytes: 100 * 1024 * 1024, // 100 MB
    readRateLimit: 100,
    writeRateLimit: 30,
  },
  pro: {
    maxWorkspaces: 5,
    maxBoardsPerWorkspace: 50,
    maxBoardsTotal: 'unlimited',
    maxColumnsPerBoard: 'unlimited',
    maxInvitedMembersPerBoard: 20,
    maxGuestsPerBoard: 10,
    maxStorageBytes: 10 * 1024 * 1024 * 1024, // 10 GB
    readRateLimit: 500,
    writeRateLimit: 200,
  },
  enterprise: {
    maxWorkspaces: 'unlimited',
    maxBoardsPerWorkspace: 'unlimited',
    maxBoardsTotal: 'unlimited',
    maxColumnsPerBoard: 'unlimited',
    maxInvitedMembersPerBoard: 'unlimited',
    maxGuestsPerBoard: 'unlimited',
    maxStorageBytes: 'unlimited',
    readRateLimit: 'unlimited',
    writeRateLimit: 'unlimited',
  },
};

// Fallback tier when subscriptions feature is disabled
export const DEFAULT_UNLIMITED_TIER = SUBSCRIPTION_TIERS.enterprise;
