// Trigger worker entry point — enqueues and executes phase trigger runs.
// Called from the card-move hook (iteration 6) to validate, persist, and dispatch.

import { evaluatePhaseTierEligibility } from '../tierGate/index';
import { generateIdempotencyKey, isDuplicateRun } from '../idempotency/index';
import { createTriggerRun, createSkippedTriggerRun } from '../persistence/index';
import { runTrigger } from './dispatch';
import { emitTriggerActivity } from '../activities/index';
import type { EnqueueTriggerInput, EnqueueTriggerResult } from '../../common/types';
import { db } from '../../../../common/db';

export const workerDeps = {
  evaluatePhaseTierEligibility,
  generateIdempotencyKey,
  isDuplicateRun: (key: string) => isDuplicateRun(db, key),
  createTriggerRun,
  createSkippedTriggerRun,
  runTrigger,
  emitTriggerActivity,
};

/**
 * Enqueue a phase trigger run for async execution.
 * - Checks tier eligibility first
 * - Rejects duplicates via idempotency key
 * - Persists run record (QUEUED or SKIPPED)
 * - Fires async dispatch for allowed runs
 */
export async function enqueuePhaseTriggerRun(
  input: EnqueueTriggerInput
): Promise<EnqueueTriggerResult> {
  const idempotencyKey = generateIdempotencyKey(input);

  // [why] Reject duplicates before any side effects — idempotency is the first gate.
  const duplicate = await isDuplicateRun(db, idempotencyKey);
  if (duplicate) {
    console.log(`[triggers/worker] Duplicate run detected for key "${idempotencyKey}" — skipping.`);
    return { status: 'duplicate' };
  }

  // Tier eligibility check
  const eligibility = await evaluatePhaseTierEligibility({
    workspaceId: input.workspaceId,
    phase: input.phase,
  });

  if (!eligibility.allowed) {
    // Persist as SKIPPED for audit trail
    const run = await createSkippedTriggerRun({
      input,
      idempotencyKey,
      tier: eligibility.currentTier,
      reason: eligibility.reason ?? 'Tier ineligible',
      upgradeHint: eligibility.upgradeHint ?? '',
    });

    // Emit skipped_tier activity event
    if (run) {
      try {
        await emitTriggerActivity({
          type: 'card_phase_trigger_skipped_tier',
          cardId: input.cardId,
          boardId: input.boardId,
          runId: run.id,
          actorId: 'system', // system-triggered, no user actor
          payload: {
            phase: input.phase,
            tier: eligibility.currentTier,
            requiredTier: eligibility.requiredTier,
            reason: eligibility.reason,
          },
        });
      } catch {
        // Fire-and-forget — failures logged inside emitTriggerActivity
      }
    }

    return {
      status: 'skipped_tier',
      reason: eligibility.reason ?? 'Tier ineligible',
      requiredTier: eligibility.requiredTier,
      upgradeHint: eligibility.upgradeHint ?? '',
    };
  }

  // Persist QUEUED run
  const run = await createTriggerRun({
    input,
    idempotencyKey,
    tier: eligibility.currentTier,
  });

  if (!run) {
    // Another process beat us to it (race on unique constraint)
    return { status: 'duplicate' };
  }

  // Emit queued activity event
  try {
    await emitTriggerActivity({
      type: 'card_phase_trigger_queued',
      cardId: input.cardId,
      boardId: input.boardId,
      runId: run.id,
      actorId: 'system',
      payload: { phase: input.phase },
    });
  } catch {
    // Fire-and-forget
  }

  // Fire async dispatch (fire-and-forget — must not block card move)
  processTriggerRun(run).catch((err) => {
    console.error(
      `[triggers/worker] Async dispatch failed for run ${run.id}:`,
      err instanceof Error ? err.message : String(err)
    );
  });

  return { status: 'queued', runId: run.id };
}

/**
 * Process a trigger run asynchronously.
 * Handles the full lifecycle: QUEUED → RUNNING → SUCCEEDED/FAILED.
 * Emits started/succeeded/failed activity events.
 */
export async function processTriggerRun(run: {
  id: string;
  card_id: string;
  board_id: string;
  phase: any;
}): Promise<void> {
  // Emit started event
  try {
    await emitTriggerActivity({
      type: 'card_phase_trigger_started',
      cardId: run.card_id,
      boardId: run.board_id,
      runId: run.id,
      actorId: 'system',
      payload: { phase: run.phase },
    });
  } catch {
    // Fire-and-forget
  }

  const result = await runTrigger({ run: run as any });

  if (result.status === 'SUCCEEDED') {
    try {
      await emitTriggerActivity({
        type: 'card_phase_trigger_succeeded',
        cardId: run.card_id,
        boardId: run.board_id,
        runId: run.id,
        actorId: 'system',
        payload: {
          phase: run.phase,
          attempts: result.attempts.length,
        },
      });
    } catch {
      // Fire-and-forget
    }
  } else {
    try {
      await emitTriggerActivity({
        type: 'card_phase_trigger_failed',
        cardId: run.card_id,
        boardId: run.board_id,
        runId: run.id,
        actorId: 'system',
        payload: {
          phase: run.phase,
          attempts: result.attempts.length,
          lastError: result.lastError,
        },
      });
    } catch {
      // Fire-and-forget
    }
  }
}
