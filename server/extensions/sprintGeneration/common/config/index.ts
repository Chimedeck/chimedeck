// Sprint 176 — Sprint generation extension config.
// [why] All feature flags, tier quotas, allowed output paths, and constants
// are centralised here so the full configuration surface is visible in one place.
import type { SubscriptionTier } from '../../../subscription/common/types';

/** Feature flag key gating the sprint generation feature. */
export const SPRINT_GENERATION_FLAG_KEY = 'SPRINT_GENERATION_ENABLED';

/**
 * Allowed write paths for sprint generation output.
 * [why] Restricts file writes to the specs directory only — matches the
 * ALLOWED_PATHS used by aiEditOrchestrator's pathGuard.
 */
export const ALLOWED_OUTPUT_PATHS = [
  'specs/sprints/',
  'specs/request_changelog/',
  'specs/architecture/',
  'specs/security/',
] as const;

/** Maximum retry attempts for the sprint generation pipeline. */
export const MAX_RETRY_ATTEMPTS = 3;

/** Maximum number of refinement loop turns for generating each sprint. */
export const MAX_GENERATION_TURNS = 5;

/**
 * Tier-aware sprint generation quotas.
 * [why] Lower tiers get limited sprints; higher tiers unlock more complex
 * decomposition and additional artifact sections.
 */
export const TIER_SPRINT_QUOTAS: Record<
  string,
  {
    maxSprints: number | 'unlimited';
    dependencyGraph: boolean;
    testMatrix: boolean;
    riskRegister: boolean;
  }
> = {
  tier_1: { maxSprints: 1, dependencyGraph: false, testMatrix: false, riskRegister: false },
  tier_2: { maxSprints: 3, dependencyGraph: false, testMatrix: false, riskRegister: false },
  tier_3: { maxSprints: 6, dependencyGraph: true, testMatrix: false, riskRegister: false },
  tier_4: {
    maxSprints: 'unlimited' as const,
    dependencyGraph: true,
    testMatrix: true,
    riskRegister: true,
  },
  unlimited: {
    maxSprints: 'unlimited' as const,
    dependencyGraph: true,
    testMatrix: true,
    riskRegister: true,
  },
};

/**
 * Sprint generation run status enum — linear progression with FAILED as escape hatch.
 */
export const SprintGenRunStatus = {
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
} as const;

export type SprintGenRunStatus = (typeof SprintGenRunStatus)[keyof typeof SprintGenRunStatus];

/** Minimum tier required for the GENERATE_SPRINT phase (sourced from trigger config). */
export const GENERATE_SPRINT_MINIMUM_TIER = 'tier_3';
