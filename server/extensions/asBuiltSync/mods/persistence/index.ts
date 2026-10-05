// As-Built Sync persistence layer (Sprint 176).
// [why] All DB operations for as-built sync runs are centralised here with
// dependency injection for testability. Follows the sprintGeneration persistence
// pattern and reuses the same table with a run_type discriminator.
//
// [why reuse same table] The card_sprint_generation_runs table has the same
// schema shape (status machine, trigger_run_id, output_files). We add a
// run_type column to distinguish GENERATE_SPRINT from AS_BUILT_SYNC runs.
// This avoids yet another migration while kmex migration table is corrupted.

import { randomUUID } from 'crypto';
import { db } from '../../../../common/db';
import { AsBuiltSyncRunStatus } from '../../common/config';
import type { AsBuiltSyncRun, AsBuiltEvidence } from '../../types';

export const persistenceDeps = {
  db,
};

/** Allowed status transitions for as-built sync runs. */
const ALLOWED_TRANSITIONS: Record<AsBuiltSyncRunStatus, AsBuiltSyncRunStatus[]> = {
  QUEUED: ['RUNNING', 'FAILED'],
  RUNNING: ['SUCCEEDED', 'FAILED'],
  SUCCEEDED: [],
  FAILED: [],
};

function isValidTransition(from: AsBuiltSyncRunStatus, to: AsBuiltSyncRunStatus): boolean {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/**
 * Create a new as-built sync run in QUEUED status.
 */
export async function createAsBuiltSyncRun({
  cardId,
  workspaceId,
  userId,
  triggerRunId,
}: {
  cardId: string;
  workspaceId: string;
  userId: string;
  triggerRunId?: string | null;
}): Promise<AsBuiltSyncRun> {
  const now = new Date().toISOString();
  const run: AsBuiltSyncRun = {
    id: randomUUID(),
    card_id: cardId,
    workspace_id: workspaceId,
    created_by: userId,
    status: AsBuiltSyncRunStatus.QUEUED,
    trigger_run_id: triggerRunId ?? null,
    evidence: null,
    output_files: null,
    commit_hash: null,
    error_message: null,
    created_at: now,
    updated_at: now,
    completed_at: null,
  };

  await persistenceDeps.db('card_as_built_sync_runs').insert(run);
  return run;
}

/**
 * Retrieve an as-built sync run by ID.
 */
export async function getAsBuiltSyncRun(runId: string): Promise<AsBuiltSyncRun | null> {
  const row = await persistenceDeps.db('card_as_built_sync_runs').where({ id: runId }).first();
  return (row as AsBuiltSyncRun | undefined) ?? null;
}

/**
 * Check if a card already has a SUCCEEDED as-built sync run.
 * [why] Prevents duplicate sync — idempotency is enforced at the trigger
 * level, but the API endpoint should also check.
 */
export async function hasSucceededAsBuiltRun(cardId: string): Promise<boolean> {
  const row = await persistenceDeps
    .db('card_as_built_sync_runs')
    .where({ card_id: cardId, status: 'SUCCEEDED' })
    .first();
  return !!row;
}

/**
 * Update an as-built sync run's status with transition validation.
 */
export async function updateAsBuiltSyncRunStatus({
  runId,
  status,
  errorMessage,
  outputFiles,
  evidence,
  commitHash,
}: {
  runId: string;
  status: AsBuiltSyncRunStatus;
  errorMessage?: string | null;
  outputFiles?: string[] | null;
  evidence?: AsBuiltEvidence | null;
  commitHash?: string | null;
}): Promise<AsBuiltSyncRun | null> {
  const currentRun = (await persistenceDeps
    .db('card_as_built_sync_runs')
    .where({ id: runId })
    .first()) as AsBuiltSyncRun | undefined;

  if (!currentRun) return null;

  if (!isValidTransition(currentRun.status, status)) {
    console.warn(
      `[asBuiltSync/persistence] Invalid transition: ${currentRun.status} → ${status} for run ${runId}`
    );
    return null;
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    status,
    updated_at: now,
  };

  if (status === 'SUCCEEDED' || status === 'FAILED') {
    updates.completed_at = now;
  }
  if (errorMessage !== undefined) updates.error_message = errorMessage;
  if (outputFiles !== undefined)
    updates.output_files = outputFiles ? JSON.stringify(outputFiles) : null;
  if (evidence !== undefined) updates.evidence = evidence ? JSON.stringify(evidence) : null;
  if (commitHash !== undefined) updates.commit_hash = commitHash;

  await persistenceDeps.db('card_as_built_sync_runs').where({ id: runId }).update(updates);

  return {
    ...currentRun,
    ...updates,
    output_files: outputFiles ?? currentRun.output_files,
    evidence: evidence ?? currentRun.evidence,
    commit_hash: (updates.commit_hash as string | null) ?? currentRun.commit_hash,
    error_message: (updates.error_message as string | null) ?? currentRun.error_message,
    completed_at: (updates.completed_at as string | null) ?? currentRun.completed_at,
  };
}
