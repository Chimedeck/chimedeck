// Sprint 176 — Sprint generation pipeline orchestrator.
// [why] Composes the four pipeline steps (readRequirements, generateArtifacts,
// createSprintCards, commit) into a single execution flow. Follows the
// aiEditOrchestrator runPipeline pattern with step tracking and error handling.
import { readRequirements } from './readRequirements';
import { generateArtifacts } from './generateArtifacts';
import { createSprintCards } from './createSprintCards';
import { enforceQuotaWithActivity } from '../tierPolicy/quotaEnforcer';
import { resolveTierPolicy } from '../tierPolicy';
import {
  createSprintGenRun,
  updateSprintGenRunStatus,
  getSprintGenRun,
} from '../persistence';
import {
  emitSprintGenStarted,
  emitSprintGenArtifactCreated,
  emitSprintGenCardCreated,
  emitSprintGenCompleted,
  emitSprintGenFailed,
} from '../activities';
import { commit } from '../../../aiEditOrchestrator/mods/committer';
import type {
  SprintGenerationRun,
  SprintArtifact,
} from '../../types';

export interface PipelineDeps {
  readRequirements: typeof readRequirements;
  generateArtifacts: typeof generateArtifacts;
  createSprintCards: typeof createSprintCards;
  enforceQuotaWithActivity: typeof enforceQuotaWithActivity;
  createSprintGenRun: typeof createSprintGenRun;
  updateSprintGenRunStatus: typeof updateSprintGenRunStatus;
  getSprintGenRun: typeof getSprintGenRun;
  commit: typeof commit;
  emitSprintGenStarted: typeof emitSprintGenStarted;
  emitSprintGenArtifactCreated: typeof emitSprintGenArtifactCreated;
  emitSprintGenCardCreated: typeof emitSprintGenCardCreated;
  emitSprintGenCompleted: typeof emitSprintGenCompleted;
  emitSprintGenFailed: typeof emitSprintGenFailed;
}

export const pipelineDeps: PipelineDeps = {
  readRequirements,
  generateArtifacts,
  createSprintCards,
  enforceQuotaWithActivity,
  createSprintGenRun,
  updateSprintGenRunStatus,
  getSprintGenRun,
  commit,
  emitSprintGenStarted,
  emitSprintGenArtifactCreated,
  emitSprintGenCardCreated,
  emitSprintGenCompleted,
  emitSprintGenFailed,
};

/**
 * Run the full sprint generation pipeline for a card.
 *
 * Pipeline steps:
 * 1. Create run record (QUEUED → RUNNING)
 * 2. Read requirements (cardChat READY_FOR_REVIEW session + context snapshot)
 * 3. Generate artifacts (sprint specs, sprint plan, changelog)
 * 4. Apply tier quota (truncate sprints if needed)
 * 5. Create sprint cards on board (one per generated sprint)
 * 6. Commit artifacts via aiEditOrchestrator committer
 * 7. Mark run SUCCEEDED or FAILED
 *
 * [why] Runs asynchronously — the API returns the run immediately in QUEUED
 * status and this pipeline runs in the background. The caller (triggers/dispatch)
 * or API handler polls the run status for completion.
 */
export async function runSprintGenerationPipeline({
  cardId,
  workspaceId,
  boardId,
  userId,
  triggerRunId,
  snapshotId,
}: {
  cardId: string;
  workspaceId: string;
  boardId: string;
  userId: string;
  triggerRunId?: string | null;
  snapshotId?: string | null;
}): Promise<{ success: boolean; run: SprintGenerationRun; error?: string }> {
  const deps = pipelineDeps;

  // 1. Create run record
  let run = await deps.createSprintGenRun({
    cardId,
    workspaceId,
    userId,
    snapshotId,
    triggerRunId,
  });

  // Emit started event
  try {
    await deps.emitSprintGenStarted({
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
  const runningRun = await deps.updateSprintGenRunStatus({
    runId: run.id,
    status: 'RUNNING',
  });

  if (!runningRun) {
    await deps.emitSprintGenFailed({
      cardId,
      boardId,
      runId: run.id,
      actorId: userId,
      payload: { reason: 'Failed to transition to RUNNING' },
    });
    return { success: false, run, error: 'Failed to transition run to RUNNING' };
  }
  run = runningRun;

  // 3. Read requirements
  const reqResult = await deps.readRequirements({ cardId });
  if (reqResult.status !== 200 || !reqResult.data) {
    const errorMsg = reqResult.message ?? 'Failed to read requirements';
    await deps.updateSprintGenRunStatus({
      runId: run.id,
      status: 'FAILED',
      errorMessage: errorMsg,
    });
    await deps.emitSprintGenFailed({
      cardId,
      boardId,
      runId: run.id,
      actorId: userId,
      payload: { reason: errorMsg, step: 'readRequirements' },
    });
    return { success: false, run, error: errorMsg };
  }

  // Persist requirement packet on the run
  await deps.updateSprintGenRunStatus({
    runId: run.id,
    status: 'RUNNING',
    requirementPacket: {
      cardTitle: reqResult.data.requirementPacket.cardTitle,
      qualityScore: reqResult.data.requirementPacket.qualityScore,
      earsCount: reqResult.data.requirementPacket.earsRequirements.length,
      acCount: reqResult.data.requirementPacket.acceptanceCriteria.length,
    },
  });

  // 4. Determine tier (from the trigger run context or default to workspace tier)
  // [why] The tier is embedded in the trigger run — if we have a trigger_run_id,
  // we read the tier from there. Otherwise, use tier_2 as default for direct API calls.
  let tier = 'tier_2';
  if (triggerRunId) {
    try {
      const triggerRun = await deps
        .getSprintGenRun(triggerRunId)
        .then(() => null) // trigger runs are in a different table
        .catch(() => null);

      // Try reading from card_phase_trigger_runs
      const trRow = await (deps as any).db
        ?.('card_phase_trigger_runs')
        .where({ id: triggerRunId })
        .select('tier')
        .first()
        .catch(() => null);

      if (trRow?.tier) {
        tier = trRow.tier as string;
      }
    } catch {
      // Use default tier
    }
  }

  // 5. Generate artifacts
  const genResult = await deps.generateArtifacts({
    cardId,
    requirementPacket: reqResult.data.requirementPacket,
    contextSnapshot: reqResult.data.contextSnapshot,
    tier,
  });

  if (genResult.status !== 200 || !genResult.data) {
    const errorMsg = genResult.message ?? 'Failed to generate artifacts';
    await deps.updateSprintGenRunStatus({
      runId: run.id,
      status: 'FAILED',
      errorMessage: errorMsg,
    });
    await deps.emitSprintGenFailed({
      cardId,
      boardId,
      runId: run.id,
      actorId: userId,
      payload: { reason: errorMsg, step: 'generateArtifacts' },
    });
    return { success: false, run, error: errorMsg };
  }

  // Emit artifact created events
  for (const artifact of genResult.data.artifacts) {
    try {
      await deps.emitSprintGenArtifactCreated({
        cardId,
        boardId,
        runId: run.id,
        actorId: userId,
        payload: {
          sprintNumber: artifact.sprintNumber,
          filePath: artifact.filePath,
          reqCount: artifact.requirements.length,
          acCount: artifact.acceptanceCriteria.length,
        },
      });
    } catch {
      // Fire-and-forget
    }
  }

  // 6. Apply tier quota
  const quotaResult = await deps.enforceQuotaWithActivity({
    artifacts: genResult.data.artifacts,
    tier,
    cardId,
    boardId,
    runId: run.id,
    actorId: userId,
  });

  // 7. Create sprint cards
  const createdFiles = genResult.data.artifacts.map(a => a.filePath);
  const cardResult = await deps.createSprintCards({
    cardId,
    workspaceId,
    boardId,
    userId,
    runId: run.id,
    artifacts: quotaResult.allowedArtifacts,
  });

  if (cardResult.status !== 201 && cardResult.status !== 200) {
    // Non-fatal — continue with commit even if card creation fails
    console.warn(
      `[sprintGeneration/pipeline] Card creation incomplete for run ${run.id}:`,
      cardResult.message,
    );
  }

  // Emit card created events
  if (cardResult.data) {
    for (const card of cardResult.data.createdCards) {
      try {
        await deps.emitSprintGenCardCreated({
          cardId,
          boardId,
          runId: run.id,
          actorId: userId,
          payload: {
            sprintCardId: card.sprintCardId,
            sprintNumber: card.sprintNumber,
          },
        });
      } catch {
        // Fire-and-forget
      }
    }
  }

  // 8. Commit artifacts
  if (createdFiles.length > 0) {
    try {
      const commitResult = await deps.commit({
        runId: run.id,
        cardId,
        touchedFiles: createdFiles,
        message: `feat(sprint-gen): generate ${quotaResult.allowedArtifacts.length} sprint(s) from card ${cardId} [SPRINT-GEN]`,
        push: true,
      });

      if (commitResult.status >= 400) {
        console.warn(
          `[sprintGeneration/pipeline] Commit warning for run ${run.id}:`,
          commitResult.message,
        );
        // Non-fatal — still mark as succeeded
      }
    } catch (error) {
      console.warn(
        `[sprintGeneration/pipeline] Commit failed for run ${run.id}:`,
        error instanceof Error ? error.message : String(error),
      );
      // Non-fatal
    }
  }

  // 9. Mark SUCCEEDED
  const finalRun = await deps.updateSprintGenRunStatus({
    runId: run.id,
    status: 'SUCCEEDED',
    outputFiles: createdFiles,
  });

  await deps.emitSprintGenCompleted({
    cardId,
    boardId,
    runId: run.id,
    actorId: userId,
    payload: {
      sprintCount: quotaResult.allowedArtifacts.length,
      createdCards: cardResult.data?.createdCards.length ?? 0,
      skippedSprints: quotaResult.skippedSprints.length,
      filesCreated: createdFiles.length,
      requiresHumanApproval: resolveTierPolicy({ tier, sprintCount: genResult.data.artifacts.length }).requiresHumanApproval,
    },
  });

  return { success: true, run: finalRun ?? run };
}
