// Activity event emission for trigger run lifecycle events.
// Events are dispatched via the central dispatchEvent so they appear
// in the card activity stream, trigger webhooks, and feed automation.

import { dispatchEvent } from '../../../../mods/events/dispatch';
import type { TriggerActivityInput } from '../../common/types';

export const triggerActivityDeps = {
  dispatchEvent,
};

/**
 * Emit a trigger run lifecycle event. All events are fire-and-forget —
 * failures are logged but never block the trigger dispatch.
 */
export async function emitTriggerActivity({
  type,
  cardId,
  boardId,
  runId,
  actorId,
  payload,
}: TriggerActivityInput): Promise<void> {
  try {
    await triggerActivityDeps.dispatchEvent({
      type,
      entityId: cardId,
      boardId,
      actorId,
      payload: {
        runId,
        ...(payload ?? {}),
      },
    });
  } catch (error) {
    // [why] Activity emission must never fail the trigger dispatch.
    console.error(
      '[triggers/activities] Failed to emit event:',
      type,
      error instanceof Error ? error.message : String(error)
    );
  }
}
