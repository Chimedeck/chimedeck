// Tier gating for workflow phase triggers.
// Checks workspace entitlements to determine if a phase can execute.
import { resolveWorkspaceEntitlements } from '../../../subscription/common/entitlements';
import { PHASE_TIER_MINIMUMS } from '../../common/config';
import type { TierEligibilityResult } from '../../common/types';
import type { WorkflowPhase } from '../../../stateTransitions/common/types';
import { TIER_ORDER, type CanonicalTierId } from '../../../../config/subscription-tiers';

export const tierGateDeps = {
  resolveWorkspaceEntitlements,
};

/**
 * Evaluate whether a workspace is eligible to run a given workflow phase.
 * Checks both the agenticWorkflow boolean feature and the per-phase minimum tier.
 */
export async function evaluatePhaseTierEligibility({
  workspaceId,
  phase,
}: {
  workspaceId: string;
  phase: WorkflowPhase;
}): Promise<TierEligibilityResult> {
  const { tier, features } = await tierGateDeps.resolveWorkspaceEntitlements(
    workspaceId,
  );

  // [why] If the workspace doesn't have the agenticWorkflow feature at all,
  // no phases can execute — even ones without a specific tier minimum.
  if (!features.agenticWorkflow) {
    return {
      allowed: false,
      requiredTier: 'tier_2', // minimum tier to unlock the feature
      currentTier: tier,
      reason: 'Agentic workflow features require a Business or higher plan.',
      upgradeHint: `Upgrade to Business or Enterprise to unlock agentic workflow phases.`,
    };
  }

  const phaseMinimum = PHASE_TIER_MINIMUMS[phase];

  // Phases not listed in PHASE_TIER_MINIMUMS are always allowed
  // if the workspace has agenticWorkflow enabled.
  if (!phaseMinimum) {
    return {
      allowed: true,
      requiredTier: tier,
      currentTier: tier,
    };
  }

  const tierIndex = TIER_ORDER.indexOf(tier as CanonicalTierId);
  const requiredIndex = TIER_ORDER.indexOf(phaseMinimum as CanonicalTierId);

  if (tierIndex < requiredIndex) {
    return {
      allowed: false,
      requiredTier: phaseMinimum,
      currentTier: tier,
      reason: `Phase "${phase}" requires ${phaseMinimum} tier or higher. Current tier: ${tier}.`,
      upgradeHint: `Upgrade to ${tierDisplayName(phaseMinimum)} to unlock the "${phase}" phase.`,
    };
  }

  return {
    allowed: true,
    requiredTier: phaseMinimum,
    currentTier: tier,
  };
}

/** Human-readable tier name for upgrade hints. */
function tierDisplayName(tier: CanonicalTierId): string {
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
