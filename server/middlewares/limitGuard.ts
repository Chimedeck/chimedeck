// Resource limit guard middleware.
// Resolves tier quotas for a workspace (or user) and enforces hard caps on creation endpoints.
// Returns a 402 Response when current usage meets or exceeds the tier quota, null otherwise.
//
// Pass-through when SUBSCRIPTIONS_ENABLED is false (master kill switch).

import { env } from '../config/env';
import { SUBSCRIPTION_TIERS } from '../config/subscription-tiers';
import { getCurrentTier } from '../extensions/subscription/common/subscriptionRepo';
import { exceeds } from '../common/limits';
import type { QuotaValue, TierQuotas } from '../config/subscription-tiers';
import type { SubscriptionTier } from '../extensions/subscription/common/types';
import { db } from '../common/db';

// Maps stored tier IDs to canonical tier names used by SUBSCRIPTION_TIERS.
const TIER_NAME_MAP: Record<SubscriptionTier, string> = {
  tier_1: 'free',
  tier_2: 'pro',
  unlimited: 'enterprise',
};

// The subset of TierQuotas keys that the limit guard can enforce.
export type LimitKey = Extract<
  keyof TierQuotas,
  'maxWorkspaces' | 'maxBoardsPerWorkspace' | 'maxBoardsTotal' | 'maxColumnsPerBoard'
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
          upgradeUrl: '/settings/billing',
        },
      },
    },
    { status: 402 },
  );
}

/**
 * Resolve the best tier for a user across all workspaces they own.
 * Returns 'tier_1' (free) when the user has no workspaces yet.
 *
 * [context] Used for workspace-creation cap checks where no workspace ID exists yet.
 */
async function getBestTierForUser(userId: string): Promise<SubscriptionTier> {
  const row = await db('workspace_subscriptions as ws')
    .join('memberships as m', 'ws.workspace_id', 'm.workspace_id')
    .where('m.user_id', userId)
    .where('m.role', 'OWNER')
    .orderByRaw(
      `CASE ws.tier WHEN 'unlimited' THEN 3 WHEN 'tier_2' THEN 2 ELSE 1 END DESC`,
    )
    .first<{ tier: SubscriptionTier }>();
  return row?.tier ?? 'tier_1';
}

/**
 * Workspace-level limit guard.
 * Resolves the user's best subscription tier and enforces the maxWorkspaces quota.
 *
 * Call before persisting a new workspace. Returns null to allow, 402 Response to block.
 */
export async function applyWorkspaceLimitGuard({
  userId,
  currentUsage,
}: {
  userId: string;
  currentUsage: number;
}): Promise<Response | null> {
  if (!env.SUBSCRIPTIONS_ENABLED) return null;

  const tier = await getBestTierForUser(userId);
  return buildLimitResponse(tier, 'maxWorkspaces', currentUsage);
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
  limitKey: Exclude<LimitKey, 'maxWorkspaces'>;
  currentUsage: number;
}): Promise<Response | null> {
  if (!env.SUBSCRIPTIONS_ENABLED) return null;

  const tier = await getCurrentTier(workspaceId);
  return buildLimitResponse(tier, limitKey, currentUsage);
}
