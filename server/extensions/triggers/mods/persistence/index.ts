// Persistence helpers for trigger runs and attempts (Sprint 173).
// Pure DB helpers with dependency injection, following the cardChat lifecycle pattern.

import { randomUUID } from 'crypto';
import { db } from '../../../../common/db';
import type {
  TriggerRun,
  TriggerRunStatus,
  TriggerAttempt,
  EnqueueTriggerInput,
} from '../../common/types';

export const triggerPersistenceDeps = {
  db,
};

// [why] Allowed status transitions — QUEUED→RUNNING→SUCCEEDED|FAILED|SKIPPED.
const ALLOWED_TRANSITIONS: Record<TriggerRunStatus, TriggerRunStatus[]> = {
  QUEUED: ['RUNNING', 'SKIPPED'],
  RUNNING: ['SUCCEEDED', 'FAILED'],
  SUCCEEDED: [],
  FAILED: [],
  SKIPPED: [],
};

/** Validate a status transition. Returns true if the transition is allowed. */
function isValidTransition(from: TriggerRunStatus, to: TriggerRunStatus): boolean {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/**
 * Create a new trigger run record in QUEUED status.
 * Returns null if the idempotency key already exists (duplicate).
 */
export async function createTriggerRun({
  input,
  idempotencyKey,
  tier,
}: {
  input: EnqueueTriggerInput;
  idempotencyKey: string;
  tier: string | null;
}): Promise<TriggerRun | null> {
  const runId = randomUUID();
  const now = new Date().toISOString();

  try {
    const run: TriggerRun = {
      id: runId,
      card_id: input.cardId,
      list_id: input.listId,
      workspace_id: input.workspaceId,
      board_id: input.boardId,
      phase: input.phase,
      status: 'QUEUED',
      tier: tier as TriggerRun['tier'],
      move_event_id: input.moveEventId,
      idempotency_key: idempotencyKey,
      failure_reason: null,
      failure_upgrade_hint: null,
      created_at: now,
      updated_at: now,
      completed_at: null,
    };

    await triggerPersistenceDeps.db('card_phase_trigger_runs').insert(run);

    return run;
  } catch (error: any) {
    // [why] If the UNIQUE constraint on (card_id, list_id, phase, move_event_id)
    // or idempotency_key fires, treat as duplicate.
    if (
      error?.message?.includes('unique') ||
      error?.message?.includes('UNIQUE') ||
      error?.code === '23505'
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * Create a trigger run with SKIPPED status (tier-gated rejections).
 */
export async function createSkippedTriggerRun({
  input,
  idempotencyKey,
  tier,
  reason,
  upgradeHint,
}: {
  input: EnqueueTriggerInput;
  idempotencyKey: string;
  tier: string;
  reason: string;
  upgradeHint: string;
}): Promise<TriggerRun | null> {
  const runId = randomUUID();
  const now = new Date().toISOString();

  try {
    const run: TriggerRun = {
      id: runId,
      card_id: input.cardId,
      list_id: input.listId,
      workspace_id: input.workspaceId,
      board_id: input.boardId,
      phase: input.phase,
      status: 'SKIPPED',
      tier: tier as TriggerRun['tier'],
      move_event_id: input.moveEventId,
      idempotency_key: idempotencyKey,
      failure_reason: reason,
      failure_upgrade_hint: upgradeHint,
      created_at: now,
      updated_at: now,
      completed_at: now,
    };

    await triggerPersistenceDeps.db('card_phase_trigger_runs').insert(run);

    return run;
  } catch (error: any) {
    if (
      error?.message?.includes('unique') ||
      error?.message?.includes('UNIQUE') ||
      error?.code === '23505'
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * Update a trigger run's status. Validates the transition before applying.
 * Returns the updated run or null if the transition is invalid.
 */
export async function updateTriggerRunStatus({
  runId,
  status,
  failureReason = null,
  failureUpgradeHint = null,
}: {
  runId: string;
  status: TriggerRunStatus;
  failureReason?: string | null;
  failureUpgradeHint?: string | null;
}): Promise<TriggerRun | null> {
  const currentRun = (await triggerPersistenceDeps
    .db('card_phase_trigger_runs')
    .where({ id: runId })
    .first()) as TriggerRun | undefined;

  if (!currentRun) return null;

  if (!isValidTransition(currentRun.status, status)) {
    console.warn(
      `[triggers/persistence] Invalid transition: ${currentRun.status} → ${status} for run ${runId}`
    );
    return null;
  }

  const now = new Date().toISOString();
  const updateFields: Record<string, any> = {
    status,
    updated_at: now,
  };

  if (status === 'SUCCEEDED' || status === 'FAILED' || status === 'SKIPPED') {
    updateFields.completed_at = now;
  }

  if (failureReason) {
    updateFields.failure_reason = failureReason;
  }
  if (failureUpgradeHint) {
    updateFields.failure_upgrade_hint = failureUpgradeHint;
  }

  await triggerPersistenceDeps
    .db('card_phase_trigger_runs')
    .where({ id: runId })
    .update(updateFields);

  return {
    ...currentRun,
    ...updateFields,
    completed_at: updateFields.completed_at ?? currentRun.completed_at,
    failure_reason: updateFields.failure_reason ?? currentRun.failure_reason,
    failure_upgrade_hint: updateFields.failure_upgrade_hint ?? currentRun.failure_upgrade_hint,
  };
}

/**
 * Create a trigger attempt for a run.
 */
export async function createTriggerAttempt({
  runId,
  attemptNumber,
}: {
  runId: string;
  attemptNumber: number;
}): Promise<TriggerAttempt> {
  const attemptId = randomUUID();
  const now = new Date().toISOString();

  const attempt: TriggerAttempt = {
    id: attemptId,
    run_id: runId,
    attempt_number: attemptNumber,
    status: 'RUNNING',
    error_message: null,
    error_payload: null,
    started_at: now,
    completed_at: null,
  };

  await triggerPersistenceDeps.db('card_phase_trigger_attempts').insert(attempt);

  return attempt;
}

/**
 * Mark an attempt as SUCCEEDED or FAILED.
 */
export async function completeTriggerAttempt({
  attemptId,
  success,
  errorMessage = null,
  errorPayload = null,
}: {
  attemptId: string;
  success: boolean;
  errorMessage?: string | null;
  errorPayload?: string | null;
}): Promise<void> {
  const now = new Date().toISOString();
  const updateFields: Record<string, any> = {
    status: success ? 'SUCCEEDED' : 'FAILED',
    completed_at: now,
  };

  if (!success) {
    updateFields.error_message = errorMessage;
    updateFields.error_payload = errorPayload;
  }

  await triggerPersistenceDeps
    .db('card_phase_trigger_attempts')
    .where({ id: attemptId })
    .update(updateFields);
}
