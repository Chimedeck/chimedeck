// Resource limit guard middleware.
// Resolves tier quotas for a workspace and enforces hard caps on creation endpoints.
// Returns a 402 Response when current usage meets or exceeds the tier quota, null otherwise.
//
// Pass-through when SUBSCRIPTIONS_ENABLED is false (master kill switch).

import { env } from '../config/env';
import { SUBSCRIPTION_TIERS } from '../config/subscription-tiers';
import { getCurrentTier } from '../extensions/subscription/common/subscriptionRepo';
import { exceeds } from '../common/limits';
import type { QuotaValue, TierQuotas } from '../config/subscription-tiers';
import type { SubscriptionTier } from '../extensions/subscription/common/types';

// Maps stored tier IDs to canonical tier names used by SUBSCRIPTION_TIERS.
const TIER_NAME_MAP: Record<SubscriptionTier, string> = {
  tier_1: 'free',
  tier_2: 'pro',
  unlimited: 'enterprise',
};

// The subset of TierQuotas keys that the limit guard can enforce.
export type LimitKey = Extract<
  keyof TierQuotas,
  | 'maxBoardsPerWorkspace'
  | 'maxBoardsTotal'
  | 'maxColumnsPerBoard'
  | 'maxInvitedMembersPerBoard'
  | 'maxGuestsPerBoard'
  | 'maxStorageBytes'
>;

/**
 * Resolve quota value for a specific limitKey from a given tier.
 */
export function resolveQuota(tier: SubscriptionTier, limitKey: LimitKey): QuotaValue {
  const tierName = TIER_NAME_MAP[tier] ?? 'free';
  const quotas = SUBSCRIPTION_TIERS[tierName];
  return quotas[limitKey];
}

/**
 * Build a 402 limit-reached response or null if usage is within quota.
 */
export function buildLimitResponse(
  tier: SubscriptionTier,
  limitKey: LimitKey,
  currentUsage: number,
  workspaceId?: string,
): Response | null {
  const quota = resolveQuota(tier, limitKey);

  if (!exceeds(currentUsage, quota)) return null;

  return Response.json(
    {
      error: {
        code: 'limit-reached',
        message: `You have reached the ${limitKey} limit for your plan.`,
        data: {
          limit: limitKey,
          currentUsage,
          quota: quota === 'unlimited' ? 'unlimited' : quota,
          upgradeUrl: workspaceId ? `/workspace/${workspaceId}/billing` : '/workspace',
        },
      },
    },
    { status: 402 },
  );
}

/**
 * Resource limit guard for board and list creation.
 * Resolves the workspace subscription tier and enforces the given limitKey quota.
 *
 * Call before persisting a new resource. Returns null to allow, 402 Response to block.
 */
export async function applyLimitGuard({
  workspaceId,
  limitKey,
  currentUsage,
}: {
  workspaceId: string;
  limitKey: LimitKey;
  currentUsage: number;
}): Promise<Response | null> {
  if (!env.SUBSCRIPTIONS_ENABLED) return null;

  const tier = await getCurrentTier(workspaceId);
  return buildLimitResponse(tier, limitKey, currentUsage, workspaceId);
}
