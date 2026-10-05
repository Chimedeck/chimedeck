// Workspace entitlements resolver.
// Single source of truth for what a workspace can do based on tier + subscription state.

import { SUBSCRIPTION_TIERS, type BooleanFeatures } from '../../../config/subscription-tiers';
import { FEATURE_KEYS } from './featureKeys';
import { getCurrentTier } from './subscriptionRepo';
import type { SubscriptionTier } from './types';

// Map stored tier IDs to canonical tier names
const TIER_ID_MAP: Record<SubscriptionTier, keyof typeof SUBSCRIPTION_TIERS> = {
  tier_1: 'personal',
  tier_2: 'hobby',
  tier_3: 'pro',
  tier_4: 'business',
  unlimited: 'enterprise',
};

const FREE_TIER_QUOTAS = SUBSCRIPTION_TIERS.personal as NonNullable<
  (typeof SUBSCRIPTION_TIERS)[string]
>;

export interface WorkspaceEntitlements {
  [FEATURE_KEYS.workspace.maxWorkspaces]: number | 'unlimited';
  [FEATURE_KEYS.board.maxPerWorkspace]: number | 'unlimited';
  [FEATURE_KEYS.board.maxTotal]: number | 'unlimited';
  [FEATURE_KEYS.list.maxPerBoard]: number | 'unlimited';
  [FEATURE_KEYS.card.maxPerBoard]: number | 'unlimited';
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
  const tierName: keyof typeof SUBSCRIPTION_TIERS = TIER_ID_MAP[tier] ?? 'personal';
  const quotas = SUBSCRIPTION_TIERS[tierName] ?? FREE_TIER_QUOTAS;

  return {
    [FEATURE_KEYS.workspace.maxWorkspaces]: quotas.maxWorkspaces,
    [FEATURE_KEYS.board.maxPerWorkspace]: quotas.maxBoardsPerWorkspace,
    [FEATURE_KEYS.board.maxTotal]: quotas.maxBoardsTotal,
    [FEATURE_KEYS.list.maxPerBoard]: quotas.maxColumnsPerBoard,
    [FEATURE_KEYS.card.maxPerBoard]: quotas.maxCardsPerBoard,
    [FEATURE_KEYS.member.maxInvitedPerBoard]: quotas.maxInvitedMembersPerBoard,
    [FEATURE_KEYS.guest.maxPerBoard]: quotas.maxGuestsPerBoard,
    [FEATURE_KEYS.storage.maxBytes]: quotas.maxStorageBytes,
    [FEATURE_KEYS.rateLimit.readPerMinute]: quotas.readRateLimit,
    [FEATURE_KEYS.rateLimit.writePerMinute]: quotas.writeRateLimit,
  };
}

export interface WorkspaceFeatureEntitlements {
  tier: SubscriptionTier;
  features: BooleanFeatures;
}

/**
 * Resolve a workspace's boolean feature entitlements by workspace ID.
 * Used by the feature-gate middleware to check if a tier has access to a gated feature.
 * Returns { tier, features } where features is the boolean flag map for that tier.
 */
export async function resolveWorkspaceEntitlements(
  workspaceId: string
): Promise<WorkspaceFeatureEntitlements> {
  const tier = await getCurrentTier(workspaceId);
  const tierName: keyof typeof SUBSCRIPTION_TIERS = TIER_ID_MAP[tier] ?? 'personal';
  const quotas = SUBSCRIPTION_TIERS[tierName] ?? FREE_TIER_QUOTAS;
  return { tier, features: quotas.features };
}
