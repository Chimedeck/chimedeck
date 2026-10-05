// Trigger run dispatch — executes phase workflows with retry and backoff.
// Calls stub downstream processors (actual workflows are Sprint 175/176).
// Manages attempt tracking, status transitions, and dead-letter logging.

import { MAX_RETRY_ATTEMPTS, RETRY_BACKOFF_MS } from '../../common/config';
import type { WorkflowPhase } from '../../../stateTransitions/common/types';
import type { TriggerRun, TriggerAttempt } from '../../common/types';
import {
  createTriggerAttempt,
  completeTriggerAttempt,
  updateTriggerRunStatus,
} from '../persistence/index';
import { logDeadLetter } from '../deadLetter/index';

export const triggerDispatchDeps = {
  createTriggerAttempt,
  completeTriggerAttempt,
  updateTriggerRunStatus,
  logDeadLetter,
};

// ── Stub downstream processors ──
// [why] Sprint 173 delivers the engine only. Actual workflow implementations
// (docs sync, sprint gen, as-built sync) are Sprint 175/176. Stubs log intent
// and return success so the engine path is fully testable now.

interface ProcessResult {
  success: boolean;
  error?: string;
}

async function processSyncDocument({
  cardId,
  phase,
}: {
  cardId: string;
  phase: WorkflowPhase;
}): Promise<ProcessResult> {
  const strictMode = phase === 'READY_FOR_DEV';
  console.log(`[triggers/dispatch] SYNC_DOCUMENT stub for card ${cardId} (strict=${strictMode})`);
  return { success: true };
}

async function processGenerateSprint({
  cardId,
  workspaceId,
  boardId,
  runId,
}: {
  cardId: string;
  workspaceId: string;
  boardId: string;
  runId: string;
}): Promise<ProcessResult> {
  // [why] Replace stub with real sprintGeneration pipeline call.
  // The pipeline reads refined requirements from cardChat, generates
  // sprint artifacts, and creates sprint cards on the board.
  try {
    const { runSprintGenerationPipeline } = await import('../../../sprintGeneration/mods/pipeline');

    const result = await runSprintGenerationPipeline({
      cardId,
      workspaceId,
      boardId,
      userId: 'system', // System-triggered
      triggerRunId: runId,
    });

    if (result.success) {
      console.log(
        `[triggers/dispatch] GENERATE_SPRINT succeeded for card ${cardId} (run ${runId})`
      );
      return { success: true };
    }

    return { success: false, error: result.error ?? 'Sprint generation pipeline failed' };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[triggers/dispatch] GENERATE_SPRINT failed for card ${cardId}: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

async function processUpdateAsBuilt({
  cardId,
  workspaceId,
  boardId,
  runId,
}: {
  cardId: string;
  workspaceId?: string;
  boardId?: string;
  runId?: string;
}): Promise<ProcessResult> {
  // [why] Replaces stub with real asBuiltSync pipeline call.
  // The pipeline collects merged PRs, changed files, and test evidence,
  // updates architecture/security/changelog docs, and commits via
  // the aiEditOrchestrator committer.
  try {
    const { runAsBuiltSyncPipeline } = await import('../../../asBuiltSync/mods/pipeline');

    if (!workspaceId || !boardId) {
      return { success: false, error: 'Missing workspaceId or boardId for as-built sync' };
    }

    const result = await runAsBuiltSyncPipeline({
      cardId,
      workspaceId,
      boardId,
      userId: 'system', // System-triggered
      triggerRunId: runId ?? null,
    });

    if (result.success) {
      console.log(
        `[triggers/dispatch] UPDATE_AS_BUILT succeeded for card ${cardId} (run ${runId})`
      );
      return { success: true };
    }

    return { success: false, error: result.error ?? 'As-built sync pipeline failed' };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[triggers/dispatch] UPDATE_AS_BUILT failed for card ${cardId}: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

// [why] GENERATE_SPRINT processors need workspaceId, boardId, and runId.
// Other processors only need cardId and phase. We use a wider type here.
type ProcessorParams = {
  cardId: string;
  phase: WorkflowPhase;
  workspaceId?: string;
  boardId?: string;
  runId?: string;
};

const PROCESSOR_MAP: Record<WorkflowPhase, (params: ProcessorParams) => Promise<ProcessResult>> = {
  NEW_DRAFT: processSyncDocument as any,
  REFINED_PENDING_REVIEW: processSyncDocument as any,
  SYNC_DOCUMENT: processSyncDocument as any,
  READY_FOR_DEV: processSyncDocument as any,
  GENERATE_SPRINT: processGenerateSprint as any,
  UPDATE_AS_BUILT: processUpdateAsBuilt as any,
};

// ── Run dispatch ──

export interface RunTriggerInput {
  run: TriggerRun;
}

export interface RunTriggerResult {
  status: 'SUCCEEDED' | 'FAILED';
  attempts: TriggerAttempt[];
  lastError: string | null;
}

/**
 * Execute a trigger run with retry logic.
 * - Transitions the run to RUNNING
 * - Creates attempt rows for each execution
 * - Retries on transient failures with exponential backoff
 * - Marks FAILED after exhausting max attempts
 * - Logs to dead-letter on terminal failure
 */
export async function runTrigger({ run }: RunTriggerInput): Promise<RunTriggerResult> {
  const attempts: TriggerAttempt[] = [];
  let lastError: string | null = null;

  // Transition to RUNNING
  await triggerDispatchDeps.updateTriggerRunStatus({
    runId: run.id,
    status: 'RUNNING',
  });

  const processor =
    PROCESSOR_MAP[run.phase] ??
    (async () => {
      console.warn(
        `[triggers/dispatch] No processor mapped for phase "${run.phase}" — defaulting to no-op`
      );
      return { success: true };
    });

  for (let attemptNum = 1; attemptNum <= MAX_RETRY_ATTEMPTS; attemptNum++) {
    // Create attempt record
    const attempt = await triggerDispatchDeps.createTriggerAttempt({
      runId: run.id,
      attemptNumber: attemptNum,
    });
    attempts.push(attempt);

    try {
      const result = await processor({
        cardId: run.card_id,
        phase: run.phase,
        workspaceId: run.workspace_id,
        boardId: run.board_id,
        runId: run.id,
      });

      if (result.success) {
        await triggerDispatchDeps.completeTriggerAttempt({
          attemptId: attempt.id,
          success: true,
        });
        await triggerDispatchDeps.updateTriggerRunStatus({
          runId: run.id,
          status: 'SUCCEEDED',
        });
        return { status: 'SUCCEEDED', attempts, lastError: null };
      }

      // Non-exception failure — record and retry
      lastError = result.error ?? 'process returned success=false';
      await triggerDispatchDeps.completeTriggerAttempt({
        attemptId: attempt.id,
        success: false,
        errorMessage: lastError,
        errorPayload: JSON.stringify(result),
      });
    } catch (error: any) {
      lastError = error instanceof Error ? error.message : String(error);
      await triggerDispatchDeps.completeTriggerAttempt({
        attemptId: attempt.id,
        success: false,
        errorMessage: lastError,
        errorPayload: error instanceof Error ? (error.stack ?? null) : null,
      });
    }

    // If more attempts remain, wait for backoff
    if (attemptNum < MAX_RETRY_ATTEMPTS) {
      const delay =
        RETRY_BACKOFF_MS[attemptNum - 1] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];
      console.warn(
        `[triggers/dispatch] Attempt ${attemptNum}/${MAX_RETRY_ATTEMPTS} failed for run ${run.id}. Retrying in ${delay}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All attempts exhausted — mark FAILED and log to dead-letter
  await triggerDispatchDeps.updateTriggerRunStatus({
    runId: run.id,
    status: 'FAILED',
    failureReason: lastError,
  });

  triggerDispatchDeps.logDeadLetter({
    runId: run.id,
    phase: run.phase,
    cardId: run.card_id,
    boardId: run.board_id,
    attempts: MAX_RETRY_ATTEMPTS,
    lastError,
  });

  return { status: 'FAILED', attempts, lastError };
}
