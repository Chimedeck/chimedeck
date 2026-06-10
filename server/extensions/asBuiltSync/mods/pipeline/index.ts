// As-Built Sync Pipeline Orchestrator (Sprint 176).
// [why] Composes the three pipeline steps (collectEvidence, updateDocs, commitAsBuilt)
// into a single execution flow. Follows the sprintGeneration runPipeline pattern
// with step tracking and error handling.

import { collectEvidence } from '../evidenceCollector';
import { updateDocs } from '../docUpdater';
import { commitAsBuilt } from '../committer';
import {
  createAsBuiltSyncRun,
  updateAsBuiltSyncRunStatus,
} from '../persistence';
import {
  emitAsBuiltStarted,
  emitAsBuiltEvidenceCollected,
  emitAsBuiltDocsUpdated,
  emitAsBuiltCommitted,
  emitAsBuiltCompleted,
  emitAsBuiltFailed,
} from '../activities';
import type { AsBuiltSyncRun, AsBuiltEvidence } from '../../types';

export interface PipelineDeps {
  collectEvidence: typeof collectEvidence;
  updateDocs: typeof updateDocs;
  commitAsBuilt: typeof commitAsBuilt;
  createAsBuiltSyncRun: typeof createAsBuiltSyncRun;
  updateAsBuiltSyncRunStatus: typeof updateAsBuiltSyncRunStatus;
  emitAsBuiltStarted: typeof emitAsBuiltStarted;
  emitAsBuiltEvidenceCollected: typeof emitAsBuiltEvidenceCollected;
  emitAsBuiltDocsUpdated: typeof emitAsBuiltDocsUpdated;
  emitAsBuiltCommitted: typeof emitAsBuiltCommitted;
  emitAsBuiltCompleted: typeof emitAsBuiltCompleted;
  emitAsBuiltFailed: typeof emitAsBuiltFailed;
}

export const pipelineDeps: PipelineDeps = {
  collectEvidence,
  updateDocs,
  commitAsBuilt,
  createAsBuiltSyncRun,
  updateAsBuiltSyncRunStatus,
  emitAsBuiltStarted,
  emitAsBuiltEvidenceCollected,
  emitAsBuiltDocsUpdated,
  emitAsBuiltCommitted,
  emitAsBuiltCompleted,
  emitAsBuiltFailed,
};

/**
 * Run the full as-built sync pipeline for a card.
 *
 * Pipeline steps:
 * 1. Create run record (QUEUED → RUNNING)
 * 2. Collect evidence (merged PRs, changed files, test evidence, card metadata)
 * 3. Update docs (architecture, security, changelog)
 * 4. Commit docs via aiEditOrchestrator committer
 * 5. Mark run SUCCEEDED or FAILED
 *
 * [why] Runs asynchronously — the API returns the run immediately in QUEUED
 * status and this pipeline runs in the background. The caller (triggers/dispatch)
 * polls the run status for completion.
 */
export async function runAsBuiltSyncPipeline({
  cardId,
  workspaceId,
  boardId,
  userId,
  triggerRunId,
}: {
  cardId: string;
  workspaceId: string;
  boardId: string;
  userId: string;
  triggerRunId?: string | null;
}): Promise<{ success: boolean; run: AsBuiltSyncRun; error?: string }> {
  const deps = pipelineDeps;

  // 1. Create run record
  let run = await deps.createAsBuiltSyncRun({
    cardId,
    workspaceId,
    userId,
    triggerRunId,
  });

  // Emit started event
  try {
    await deps.emitAsBuiltStarted({
      cardId,
      boardId,
      runId: run.id,
      actorId: userId,
      payload: { triggerRunId: triggerRunId ?? null },
    });
  } catch {
    // Fire-and-forget
  }

  // 2. Transition to RUNNING
  const runningRun = await deps.updateAsBuiltSyncRunStatus({
    runId: run.id,
    status: 'RUNNING',
  });

  if (!runningRun) {
    await deps.emitAsBuiltFailed({
      cardId,
      boardId,
      runId: run.id,
      actorId: userId,
      payload: { reason: 'Failed to transition to RUNNING' },
    });
    return {
      success: false,
      run,
      error: 'Failed to transition run to RUNNING',
    };
  }
  run = runningRun;

  // 3. Collect evidence
  const evidenceResult = await deps.collectEvidence({
    cardId,
    workspaceId,
    boardId,
  });

  if (evidenceResult.status !== 200 || !evidenceResult.data) {
    const errorMsg =
      evidenceResult.message ?? 'Failed to collect evidence';
    await deps.updateAsBuiltSyncRunStatus({
      runId: run.id,
      status: 'FAILED',
      errorMessage: errorMsg,
    });
    await deps.emitAsBuiltFailed({
      cardId,
      boardId,
      runId: run.id,
      actorId: userId,
      payload: { reason: errorMsg, step: 'collectEvidence' },
    });
    return { success: false, run, error: errorMsg };
  }

  // Persist evidence on the run
  await deps.updateAsBuiltSyncRunStatus({
    runId: run.id,
    status: 'RUNNING',
    evidence: evidenceResult.data.evidence,
  });

  // Emit evidence collected event
  try {
    await deps.emitAsBuiltEvidenceCollected({
      cardId,
      boardId,
      runId: run.id,
      actorId: userId,
      payload: {
        prCount: evidenceResult.data.evidence.mergedPrs.length,
        changedFileCount: evidenceResult.data.evidence.changedFiles.length,
        testFileCount: evidenceResult.data.evidence.testEvidence.length,
      },
    });
  } catch {
    // Fire-and-forget
  }

  const evidence: AsBuiltEvidence = evidenceResult.data.evidence;

  // 4. Update docs
  const docsResult = await deps.updateDocs({
    cardId,
    evidence,
    runId: run.id,
  });

  if (docsResult.status !== 200 || !docsResult.data) {
    const errorMsg = docsResult.message ?? 'Failed to update docs';
    await deps.updateAsBuiltSyncRunStatus({
      runId: run.id,
      status: 'FAILED',
      errorMessage: errorMsg,
    });
    await deps.emitAsBuiltFailed({
      cardId,
      boardId,
      runId: run.id,
      actorId: userId,
      payload: { reason: errorMsg, step: 'updateDocs' },
    });
    return { success: false, run, error: errorMsg };
  }

  // Emit docs updated event
  try {
    await deps.emitAsBuiltDocsUpdated({
      cardId,
      boardId,
      runId: run.id,
      actorId: userId,
      payload: {
        updatedFiles: docsResult.data.updatedFiles,
        changelogWritten: docsResult.data.changelogWritten,
      },
    });
  } catch {
    // Fire-and-forget
  }

  // 5. Commit docs
  const commitResult = await deps.commitAsBuilt({
    runId: run.id,
    cardId,
    touchedFiles: docsResult.data.updatedFiles,
  });

  if (commitResult.status >= 400) {
    console.warn(
      `[asBuiltSync/pipeline] Commit warning for run ${run.id}:`,
      commitResult.message,
    );
    // Non-fatal — still mark as succeeded
  } else {
    // Persist commit hash on success
    await deps.updateAsBuiltSyncRunStatus({
      runId: run.id,
      status: 'RUNNING',
      commitHash: commitResult.data?.commitHash ?? null,
    });

    // Emit committed event
    try {
      await deps.emitAsBuiltCommitted({
        cardId,
        boardId,
        runId: run.id,
        actorId: userId,
        payload: {
          commitHash: commitResult.data?.commitHash,
          filesCommitted: commitResult.data?.files,
        },
      });
    } catch {
      // Fire-and-forget
    }
  }

  // 6. Mark SUCCEEDED
  const finalRun = await deps.updateAsBuiltSyncRunStatus({
    runId: run.id,
    status: 'SUCCEEDED',
    outputFiles: docsResult.data.updatedFiles,
  });

  await deps.emitAsBuiltCompleted({
    cardId,
    boardId,
    runId: run.id,
    actorId: userId,
    payload: {
      filesUpdated: docsResult.data.updatedFiles.length,
      changelogWritten: docsResult.data.changelogWritten,
      commitHash: commitResult.data?.commitHash,
      // [why] As-built sync doesn't require human approval by default;
      // it's a documentation sync that should auto-commit.
      requiresHumanApproval: false,
    },
  });

  return { success: true, run: finalRun ?? run };
}
