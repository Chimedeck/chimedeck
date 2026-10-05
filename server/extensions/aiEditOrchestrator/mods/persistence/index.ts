// Sprint 175 — AI Edit Orchestrator persistence layer.
// [why] All DB operations for edit runs and steps are centralised here with
// dependency injection (db) so tests can swap in a mock database.

import { randomUUID } from 'crypto';
import { db } from '../../../../common/db';
import { EditRunStatus, EditStepName } from '../../common/config';
import { advanceState, validateTransition } from '../stateMachine';
import type { EditRun, EditStep, CreateEditRunInput, CreateEditRunResult } from '../../types';
import type { EditStepName as EditStepNameType } from '../../common/config';

export const persistenceDeps = {
  db,
  advanceState,
  validateTransition,
};

/**
 * Create a new edit run in REQUESTED status.
 * [why] Every run starts in REQUESTED; the orchestrator pipeline (Iteration 11)
 * advances it through subsequent states.
 */
export async function createEditRun({
  cardId,
  workspaceId,
  userId,
  intent,
  snapshotId,
}: CreateEditRunInput): Promise<CreateEditRunResult> {
  const now = new Date().toISOString();
  const runId = randomUUID();

  const run: EditRun = {
    id: runId,
    card_id: cardId,
    workspace_id: workspaceId,
    created_by: userId,
    status: EditRunStatus.REQUESTED,
    snapshot_id: snapshotId ?? null,
    file_scope_plan: null,
    error_message: null,
    created_at: now,
    updated_at: now,
    completed_at: null,
  };

  await persistenceDeps.db('card_ai_edit_runs').insert(run);

  return { status: 201, data: { run } };
}

/**
 * Retrieve an edit run by ID.
 */
export async function getEditRun(runId: string): Promise<EditRun | null> {
  const row = await persistenceDeps.db('card_ai_edit_runs').where({ id: runId }).first();
  return (row as EditRun | undefined) ?? null;
}

/**
 * Update an edit run's status, validating the transition through the state machine.
 * Returns the updated run on success, or an error on invalid transition.
 */
export async function updateEditRunStatus({
  run,
  nextStatus,
  errorMessage,
}: {
  run: EditRun;
  nextStatus: (typeof EditRunStatus)[keyof typeof EditRunStatus];
  errorMessage?: string;
}): Promise<
  | { status: 200; data: { run: EditRun } }
  | { status: 409; name: string; data: { message: string } }
  | { status: 404; name: string; data: { message: string } }
> {
  const validation = persistenceDeps.validateTransition({ run, nextStatus, errorMessage });
  if (!validation.valid) {
    return {
      status: 409,
      name: validation.name,
      data: { message: validation.message },
    };
  }

  const updatedRun = persistenceDeps.advanceState({ run, nextStatus, errorMessage });

  const updated = await persistenceDeps.db('card_ai_edit_runs').where({ id: run.id }).update({
    status: updatedRun.status,
    error_message: updatedRun.error_message,
    completed_at: updatedRun.completed_at,
    updated_at: updatedRun.updated_at,
  });

  if (updated === 0) {
    return {
      status: 404,
      name: 'run-not-found',
      data: { message: 'Edit run not found' },
    };
  }

  return { status: 200, data: { run: updatedRun } };
}

/**
 * Create a new edit step row for a given run and step name.
 * [why] Steps are created once per run; retries update the existing row
 * via updateEditStep with incremented attempt count.
 */
export async function createEditStep({
  runId,
  stepName,
  input,
}: {
  runId: string;
  stepName: EditStepNameType;
  input?: Record<string, unknown>;
}): Promise<EditStep> {
  const now = new Date().toISOString();
  const step: EditStep = {
    id: randomUUID(),
    run_id: runId,
    step_name: stepName,
    status: 'PENDING',
    attempt: 1,
    input: input ?? null,
    output: null,
    error: null,
    started_at: null,
    completed_at: null,
    created_at: now,
  };

  await persistenceDeps.db('card_ai_edit_steps').insert(step);
  return step;
}

/**
 * Update an existing step's status, output, or error.
 * Increments attempt count on each call.
 *
 * [why] The UNIQUE constraint on (run_id, step_name) ensures one row per step.
 * Retries call this function to update the same row with incremented attempt
 * and updated output/error.
 */
export async function updateEditStep({
  step,
  status,
  output,
  error,
}: {
  step: EditStep;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  output?: Record<string, unknown>;
  error?: Record<string, unknown>;
}): Promise<EditStep> {
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    status,
    attempt: step.attempt + 1,
    updated_at: now,
  };

  if (status === 'RUNNING' && !step.started_at) {
    updates.started_at = now;
  }
  if (status === 'SUCCEEDED' || status === 'FAILED') {
    updates.completed_at = now;
  }
  if (output !== undefined) updates.output = output;
  if (error !== undefined) updates.error = error;

  await persistenceDeps.db('card_ai_edit_steps').where({ id: step.id }).update(updates);

  const startedAt = status === 'RUNNING' && !step.started_at ? now : step.started_at;
  const completedAt = status === 'SUCCEEDED' || status === 'FAILED' ? now : step.completed_at;

  return {
    ...step,
    status,
    attempt: step.attempt + 1,
    input: step.input,
    output: (output as EditStep['output'] | undefined) ?? step.output,
    error: (error as EditStep['error'] | undefined) ?? step.error,
    started_at: startedAt,
    completed_at: completedAt,
    created_at: step.created_at,
  };
}

/**
 * Retrieve all steps for a given run, ordered by creation time.
 */
export async function getEditSteps(runId: string): Promise<EditStep[]> {
  const rows = await persistenceDeps
    .db('card_ai_edit_steps')
    .where({ run_id: runId })
    .orderBy('created_at', 'asc');
  return rows as EditStep[];
}
