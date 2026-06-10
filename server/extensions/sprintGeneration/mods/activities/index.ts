// Sprint 176 — Sprint generation activity events.
// [why] Every mutation produces immutable activity events for auditability,
// following the event_sourcing.md architecture spec. Writes to the DB
// via writeActivity() and broadcasts realtime via publishCardActivityEvent(),
// following the pattern in server/extensions/stateTransitions/common/activityLog.ts.

import { writeActivity } from '../../../activity/mods/write';
import { publishCardActivityEvent } from '../../../activity/events/publishCardActivityEvent';
import type {
  SprintGenActivityType,
  SprintGenActivityInput,
} from '../../types';

export const activitiesDeps = {
  /**
   * Emit an activity event into the DB and broadcast realtime.
   * [why] Injected for testability — tests swap this out with a mock.
   */
  writeActivity,
  publishCardActivityEvent,
};

/**
 * Emit a sprint generation activity event — writes to DB + broadcasts realtime.
 */
export async function emitSprintGenActivity(input: SprintGenActivityInput): Promise<void> {
  try {
    const activity = await activitiesDeps.writeActivity({
      entityType: 'card',
      entityId: input.cardId,
      boardId: input.boardId,
      action: input.type,
      actorId: input.actorId,
      payload: {
        cardId: input.cardId,
        runId: input.runId,
        ...(input.payload ?? {}),
      },
    });

    // Fire-and-forget realtime broadcast
    activitiesDeps.publishCardActivityEvent({
      activity,
      boardId: input.boardId ?? '',
    }).catch(() => {});
  } catch (error) {
    // [why] Activity emission is fire-and-forget — failures are logged
    // but must not block the pipeline.
    console.error(
      `[sprintGeneration/activities] Failed to emit ${input.type}:`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * Shorthand helpers for common activity event types.
 */
export async function emitSprintGenStarted({
  cardId,
  boardId,
  runId,
  actorId,
  payload,
}: Omit<SprintGenActivityInput, 'type'>): Promise<void> {
  return emitSprintGenActivity({
    type: 'sprint_generation_started',
    cardId,
    boardId,
    runId,
    actorId,
    payload,
  });
}

export async function emitSprintGenArtifactCreated({
  cardId,
  boardId,
  runId,
  actorId,
  payload,
}: Omit<SprintGenActivityInput, 'type'>): Promise<void> {
  return emitSprintGenActivity({
    type: 'sprint_generation_artifact_created',
    cardId,
    boardId,
    runId,
    actorId,
    payload,
  });
}

export async function emitSprintGenCardCreated({
  cardId,
  boardId,
  runId,
  actorId,
  payload,
}: Omit<SprintGenActivityInput, 'type'>): Promise<void> {
  return emitSprintGenActivity({
    type: 'sprint_generation_card_created',
    cardId,
    boardId,
    runId,
    actorId,
    payload,
  });
}

export async function emitSprintGenQuotaExceeded({
  cardId,
  boardId,
  runId,
  actorId,
  payload,
}: Omit<SprintGenActivityInput, 'type'>): Promise<void> {
  return emitSprintGenActivity({
    type: 'sprint_generation_quota_exceeded',
    cardId,
    boardId,
    runId,
    actorId,
    payload,
  });
}

export async function emitSprintGenCompleted({
  cardId,
  boardId,
  runId,
  actorId,
  payload,
}: Omit<SprintGenActivityInput, 'type'>): Promise<void> {
  return emitSprintGenActivity({
    type: 'sprint_generation_completed',
    cardId,
    boardId,
    runId,
    actorId,
    payload,
  });
}

export async function emitSprintGenFailed({
  cardId,
  boardId,
  runId,
  actorId,
  payload,
}: Omit<SprintGenActivityInput, 'type'>): Promise<void> {
  return emitSprintGenActivity({
    type: 'sprint_generation_failed',
    cardId,
    boardId,
    runId,
    actorId,
    payload,
  });
}
