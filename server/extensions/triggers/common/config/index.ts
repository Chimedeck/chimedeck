// Trigger engine config — centralizes feature flag key, phase-to-tier minimums,
// retry policy, and idempotency settings (Sprint 173).
import type { SubscriptionTier } from '../../../subscription/common/types';
import type { WorkflowPhase } from '../../../stateTransitions/common/types';

/** Feature flag key read at access-time from Bun.env for immediate toggles. */
export const TRIGGER_ENGINE_ENABLED_FLAG = 'AGENTIC_WORKFLOW_ENABLED';

/**
 * Minimum subscription tier required for each workflow phase.
 * Phases not listed here have no minimum (always available if agenticWorkflow is enabled).
 */
export const PHASE_TIER_MINIMUMS: Partial<Record<WorkflowPhase, SubscriptionTier>> = {
  SYNC_DOCUMENT: 'tier_2',
  GENERATE_SPRINT: 'tier_3',
  UPDATE_AS_BUILT: 'tier_4',
};

/** Maximum retry attempts for a trigger run before marking it FAILED. */
export const MAX_RETRY_ATTEMPTS = 3;

/** Exponential backoff delays in milliseconds per attempt (index 0 = first retry). */
export const RETRY_BACKOFF_MS = [1000, 4000, 16000];

/** Timeout in milliseconds before a stuck RUNNING run is considered stale. */
export const STALE_RUN_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
