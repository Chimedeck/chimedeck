// Sprint 176 — Sprint generation persistence layer.
// [why] All DB operations for sprint generation runs and generated sprint
// cards are centralised here with dependency injection for testability.
// Follows the aiEditOrchestrator persistence pattern.

import { randomUUID } from 'crypto';
import { db } from '../../../../common/db';
import { SprintGenRunStatus } from '../../common/config';
import type {
  SprintGenerationRun,
  GeneratedSprintCard,
} from '../../types';

export const persistenceDeps = {
  db,
};

/** Allowed status transitions for sprint generation runs. */
const ALLOWED_TRANSITIONS: Record<SprintGenRunStatus, SprintGenRunStatus[]> = {
  QUEUED: ['RUNNING', 'FAILED'],
  RUNNING: ['SUCCEEDED', 'FAILED'],
  SUCCEEDED: [],
  FAILED: [],
};

function isValidTransition(from: SprintGenRunStatus, to: SprintGenRunStatus): boolean {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/**
 * Create a new sprint generation run in QUEUED status.
 */
export async function createSprintGenRun({
  cardId,
  workspaceId,
  userId,
  snapshotId,
  triggerRunId,
}: {
  cardId: string;
  workspaceId: string;
  userId: string;
  snapshotId?: string | null;
  triggerRunId?: string | null;
}): Promise<SprintGenerationRun> {
  const now = new Date().toISOString();
  const run: SprintGenerationRun = {
    id: randomUUID(),
    card_id: cardId,
    workspace_id: workspaceId,
    created_by: userId,
    status: SprintGenRunStatus.QUEUED,
    tier: null,
    snapshot_id: snapshotId ?? null,
    trigger_run_id: triggerRunId ?? null,
    output_files: null,
    requirement_packet: null,
    error_message: null,
    created_at: now,
    updated_at: now,
    completed_at: null,
  };

  await persistenceDeps.db('card_sprint_generation_runs').insert(run);
  return run;
}

/**
 * Retrieve a sprint generation run by ID.
 */
export async function getSprintGenRun(runId: string): Promise<SprintGenerationRun | null> {
  const row = await persistenceDeps
    .db('card_sprint_generation_runs')
    .where({ id: runId })
    .first();
  return (row as SprintGenerationRun | undefined) ?? null;
}

/**
 * Check if a card already has a SUCCEEDED sprint generation run.
 * [why] Prevents duplicate generation — idempotency is enforced at the
 * trigger level, but the API endpoint should also check.
 */
export async function hasSucceededRun(cardId: string): Promise<boolean> {
  const row = await persistenceDeps
    .db('card_sprint_generation_runs')
    .where({ card_id: cardId, status: 'SUCCEEDED' })
    .first();
  return !!row;
}

/**
 * Update a sprint generation run's status with transition validation.
 */
export async function updateSprintGenRunStatus({
  runId,
  status,
  errorMessage,
  outputFiles,
  requirementPacket,
}: {
  runId: string;
  status: SprintGenRunStatus;
  errorMessage?: string | null;
  outputFiles?: string[] | null;
  requirementPacket?: Record<string, unknown> | null;
}): Promise<SprintGenerationRun | null> {
  const currentRun = (await persistenceDeps
    .db('card_sprint_generation_runs')
    .where({ id: runId })
    .first()) as SprintGenerationRun | undefined;

  if (!currentRun) return null;

  if (!isValidTransition(currentRun.status, status)) {
    console.warn(
      `[sprintGeneration/persistence] Invalid transition: ${currentRun.status} → ${status} for run ${runId}`,
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
  if (outputFiles !== undefined) updates.output_files = outputFiles ? JSON.stringify(outputFiles) : null;
  if (requirementPacket !== undefined) updates.requirement_packet = requirementPacket ? JSON.stringify(requirementPacket) : null;

  await persistenceDeps
    .db('card_sprint_generation_runs')
    .where({ id: runId })
    .update(updates);

  return {
    ...currentRun,
    ...updates,
    output_files: outputFiles ?? currentRun.output_files,
    requirement_packet: requirementPacket ?? currentRun.requirement_packet,
    error_message: (updates.error_message as string | null) ?? currentRun.error_message,
    completed_at: (updates.completed_at as string | null) ?? currentRun.completed_at,
  };
}

/**
 * Link a generated sprint card to the originating feature card and generation run.
 */
export async function createGeneratedSprintCard({
  sprintCardId,
  featureCardId,
  sprintGenerationRunId,
  sprintNumber,
  sprintSpecPath,
  traceLinks,
}: {
  sprintCardId: string;
  featureCardId: string;
  sprintGenerationRunId: string;
  sprintNumber: number;
  sprintSpecPath?: string | null;
  traceLinks?: Record<string, unknown> | null;
}): Promise<GeneratedSprintCard> {
  const row: GeneratedSprintCard = {
    id: randomUUID(),
    sprint_card_id: sprintCardId,
    feature_card_id: featureCardId,
    sprint_generation_run_id: sprintGenerationRunId,
    sprint_number: sprintNumber,
    sprint_spec_path: sprintSpecPath ?? null,
    trace_links: traceLinks ?? null,
    created_at: new Date().toISOString(),
  };

  await persistenceDeps
    .db('generated_sprint_cards')
    .insert(row);

  return row;
}

/**
 * Retrieve all generated sprint cards for a given generation run.
 */
export async function getGeneratedSprintCards(runId: string): Promise<GeneratedSprintCard[]> {
  const rows = await persistenceDeps
    .db('generated_sprint_cards')
    .where({ sprint_generation_run_id: runId })
    .orderBy('sprint_number', 'asc');
  return rows as GeneratedSprintCard[];
}
