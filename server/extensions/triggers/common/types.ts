// Shared types for the trigger engine (Sprint 173).
import type { WorkflowPhase } from '../../stateTransitions/common/types';
import type { SubscriptionTier } from '../../subscription/common/types';

export type TriggerRunStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED';

export interface TriggerRun {
  id: string;
  card_id: string;
  list_id: string;
  workspace_id: string;
  board_id: string;
  phase: WorkflowPhase;
  status: TriggerRunStatus;
  tier: SubscriptionTier | null;
  move_event_id: string | null;
  idempotency_key: string;
  failure_reason: string | null;
  failure_upgrade_hint: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface TriggerAttempt {
  id: string;
  run_id: string;
  attempt_number: number;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  error_message: string | null;
  error_payload: string | null;
  started_at: string;
  completed_at: string | null;
}

// ── Worker inputs ──

export interface EnqueueTriggerInput {
  cardId: string;
  listId: string;
  workspaceId: string;
  boardId: string;
  phase: WorkflowPhase;
  moveEventId: string;
}

export interface EnqueueTriggerResult {
  status: 'queued' | 'duplicate' | 'skipped_tier';
  runId?: string;
  reason?: string;
  requiredTier?: SubscriptionTier;
  upgradeHint?: string;
}

export interface SkippedTierResult extends EnqueueTriggerResult {
  status: 'skipped_tier';
  reason: string;
  requiredTier: SubscriptionTier;
  upgradeHint: string;
}

// ── Tier gate ──

export interface TierEligibilityResult {
  allowed: boolean;
  requiredTier: SubscriptionTier;
  currentTier: SubscriptionTier;
  reason?: string;
  upgradeHint?: string;
}

// ── Activity events ──

export type TriggerActivityType =
  | 'card_phase_trigger_queued'
  | 'card_phase_trigger_started'
  | 'card_phase_trigger_succeeded'
  | 'card_phase_trigger_failed'
  | 'card_phase_trigger_skipped_tier';

export interface TriggerActivityInput {
  type: TriggerActivityType;
  cardId: string;
  boardId: string | null;
  runId: string;
  actorId: string;
  payload?: Record<string, unknown>;
}
