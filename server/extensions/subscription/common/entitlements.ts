// Workspace entitlements resolver.
// Single source of truth for what a workspace can do based on tier + subscription state.

import { SUBSCRIPTION_TIERS, type TierQuotas } from '../../../config/subscription-tiers';
import { FEATURE_KEYS, type FeatureKey } from './featureKeys';
import type { SubscriptionTier } from './types';

// Map stored tier IDs to canonical tier names
const TIER_ID_MAP: Record<SubscriptionTier, keyof typeof SUBSCRIPTION_TIERS> = {
  tier_1: 'free',
  tier_2: 'pro',
  unlimited: 'enterprise',
};

export interface WorkspaceEntitlements {
  [FEATURE_KEYS.workspace.maxWorkspaces]: number | 'unlimited';
  [FEATURE_KEYS.board.maxPerWorkspace]: number | 'unlimited';
  [FEATURE_KEYS.board.maxTotal]: number | 'unlimited';
  [FEATURE_KEYS.list.maxPerBoard]: number | 'unlimited';
  [FEATURE_KEYS.member.maxInvitedPerBoard]: number | 'unlimited';
  [FEATURE_KEYS.guest.maxPerBoard]: number | 'unlimited';
  [FEATURE_KEYS.storage.maxBytes]: number | 'unlimited';
  [FEATURE_KEYS.rateLimit.readPerMinute]: number | 'unlimited';
  [FEATURE_KEYS.rateLimit.writePerMinute]: number | 'unlimited';
}

/**
 * Resolve workspace entitlements from tier + subscription state.
 * Maps stored tier ID to canonical tier quotas.
 */
export function resolveEntitlements(tier: SubscriptionTier): WorkspaceEntitlements {
  const tierName = TIER_ID_MAP[tier] || 'free';
  const quotas = SUBSCRIPTION_TIERS[tierName];

  return {
    [FEATURE_KEYS.workspace.maxWorkspaces]: quotas.maxWorkspaces,
    [FEATURE_KEYS.board.maxPerWorkspace]: quotas.maxBoardsPerWorkspace,
    [FEATURE_KEYS.board.maxTotal]: quotas.maxBoardsTotal,
    [FEATURE_KEYS.list.maxPerBoard]: quotas.maxColumnsPerBoard,
    [FEATURE_KEYS.member.maxInvitedPerBoard]: quotas.maxInvitedMembersPerBoard,
    [FEATURE_KEYS.guest.maxPerBoard]: quotas.maxGuestsPerBoard,
    [FEATURE_KEYS.storage.maxBytes]: quotas.maxStorageBytes,
    [FEATURE_KEYS.rateLimit.readPerMinute]: quotas.readRateLimit,
    [FEATURE_KEYS.rateLimit.writePerMinute]: quotas.writeRateLimit,
  };
}
