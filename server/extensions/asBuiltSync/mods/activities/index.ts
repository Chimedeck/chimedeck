// As-Built Sync activity events (Sprint 176).
// [why] Every mutation produces immutable activity events for auditability,
// following the event_sourcing.md architecture spec. Writes to the DB
// via writeActivity() and broadcasts realtime via publishCardActivityEvent(),
// following the pattern in server/extensions/stateTransitions/common/activityLog.ts.

import { writeActivity } from '../../../activity/mods/write';
import { publishCardActivityEvent } from '../../../activity/events/publishCardActivityEvent';
import type { AsBuiltActivityType, AsBuiltActivityInput } from '../../types';

export const activitiesDeps = {
  /** [why] Injected for testability — tests swap this out with a mock. */
  writeActivity,
  publishCardActivityEvent,
};

/**
 * Emit an as-built sync activity event — writes to DB + broadcasts realtime.
 */
export async function emitAsBuiltActivity(
  input: AsBuiltActivityInput,
): Promise<void> {
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
      `[asBuiltSync/activities] Failed to emit ${input.type}:`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

/** Shorthand helpers for common activity event types. */
export async function emitAsBuiltStarted({
  cardId, boardId, runId, actorId, payload,
}: Omit<AsBuiltActivityInput, 'type'>): Promise<void> {
  return emitAsBuiltActivity({
    type: 'as_built_sync_started', cardId, boardId, runId, actorId, payload,
  });
}

export async function emitAsBuiltEvidenceCollected({
  cardId, boardId, runId, actorId, payload,
}: Omit<AsBuiltActivityInput, 'type'>): Promise<void> {
  return emitAsBuiltActivity({
    type: 'as_built_sync_evidence_collected', cardId, boardId, runId, actorId, payload,
  });
}

export async function emitAsBuiltDocsUpdated({
  cardId, boardId, runId, actorId, payload,
}: Omit<AsBuiltActivityInput, 'type'>): Promise<void> {
  return emitAsBuiltActivity({
    type: 'as_built_sync_docs_updated', cardId, boardId, runId, actorId, payload,
  });
}

export async function emitAsBuiltCommitted({
  cardId, boardId, runId, actorId, payload,
}: Omit<AsBuiltActivityInput, 'type'>): Promise<void> {
  return emitAsBuiltActivity({
    type: 'as_built_sync_committed', cardId, boardId, runId, actorId, payload,
  });
}

export async function emitAsBuiltCompleted({
  cardId, boardId, runId, actorId, payload,
}: Omit<AsBuiltActivityInput, 'type'>): Promise<void> {
  return emitAsBuiltActivity({
    type: 'as_built_sync_completed', cardId, boardId, runId, actorId, payload,
  });
}

export async function emitAsBuiltFailed({
  cardId, boardId, runId, actorId, payload,
}: Omit<AsBuiltActivityInput, 'type'>): Promise<void> {
  return emitAsBuiltActivity({
    type: 'as_built_sync_failed', cardId, boardId, runId, actorId, payload,
  });
}
