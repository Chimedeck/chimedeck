// Sprint 176 — Tier policy resolver for sprint generation.
// [why] Determines what features are available at each subscription tier,
// including sprint count caps and extra artifact sections.
// Follows the triggers/mods/tierGate/index.ts pattern.
import { TIER_SPRINT_QUOTAS } from '../../common/config';
import type { TierPolicyInput, TierPolicyResult } from '../../types';
import { TIER_ORDER, type CanonicalTierId } from '../../../../config/subscription-tiers';

export const tierPolicyDeps = {
  TIER_SPRINT_QUOTAS,
  TIER_ORDER,
};

/**
 * Resolve the tier policy for a given tier and sprint count.
 * Returns what features are enabled and whether any sprints need truncation.
 */
export function resolveTierPolicy({ tier, sprintCount }: TierPolicyInput): TierPolicyResult {
  const quota = TIER_SPRINT_QUOTAS[tier];

  // [why] If tier is not recognised, fall back to tier_1 limits.
  if (!quota) {
    const fallback = TIER_SPRINT_QUOTAS.tier_1!;
    const maxSprints = fallback.maxSprints === 'unlimited' ? 'unlimited' : fallback.maxSprints;
    return {
      allowed: true,
      maxSprints,
      dependencyGraph: fallback.dependencyGraph,
      testMatrix: fallback.testMatrix,
      riskRegister: fallback.riskRegister,
      requiresHumanApproval: true, // [why] Unknown tiers default to requiring approval for safety
      truncatedSprints: [],
      upgradeHint: 'Upgrade your plan to unlock more sprint generation features.',
    };
  }

  // Enforce sprint count cap
  const maxSprints = quota.maxSprints === 'unlimited' ? ('unlimited' as const) : quota.maxSprints;

  const truncatedSprints: Array<{ sprintNumber: number; reason: string }> = [];
  const effectiveSprintCount =
    maxSprints === 'unlimited' ? sprintCount : Math.min(sprintCount, maxSprints);

  if (maxSprints !== 'unlimited' && sprintCount > maxSprints) {
    for (let i = effectiveSprintCount + 1; i <= sprintCount; i++) {
      truncatedSprints.push({
        sprintNumber: i,
        reason: `Sprint ${i} exceeds tier quota (max ${maxSprints} sprints for ${tier})`,
      });
    }
  }

  const upgradeHint =
    truncatedSprints.length > 0
      ? `Upgrade to a higher tier to generate up to ${
          TIER_SPRINT_QUOTAS.tier_4?.maxSprints === 'unlimited'
            ? 'unlimited'
            : TIER_SPRINT_QUOTAS.tier_4?.maxSprints
        } sprints with dependency graph and test matrix.`
      : undefined;

  // [why] Lower tiers (tier_1, tier_2) require human approval for generated
  // output before committing. Higher tiers (tier_3+) can skip approval.
  const requiresHumanApproval = tier === 'tier_1' || tier === 'tier_2';

  return {
    allowed: true,
    maxSprints,
    dependencyGraph: quota.dependencyGraph,
    testMatrix: quota.testMatrix,
    riskRegister: quota.riskRegister,
    requiresHumanApproval,
    truncatedSprints,
    upgradeHint,
  };
}

/**
 * Get a human-readable display name for a tier.
 */
export function tierDisplayName(tier: string): string {
  switch (tier) {
    case 'tier_1':
      return 'Personal';
    case 'tier_2':
      return 'Hobby';
    case 'tier_3':
      return 'Pro';
    case 'tier_4':
      return 'Business';
    case 'unlimited':
      return 'Enterprise';
    default:
      return tier;
  }
}
