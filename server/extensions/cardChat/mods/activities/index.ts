// Activity event emission for the card-chat refinement lifecycle.
// Events are dispatched via the central dispatchEvent so they appear
// in the card activity stream, trigger webhooks, and feed automation.

import { dispatchEvent } from '../../../../mods/events/dispatch';
import type { CardChatActivityInput } from '../../types';

export const cardChatActivityDeps = {
  dispatchEvent,
};

/**
 * Emit a card-chat lifecycle event. All events are fire-and-forget —
 * failures are logged but never block the refinement loop.
 */
export async function emitCardChatActivity({
  type,
  cardId,
  sessionId,
  actorId,
  payload,
}: CardChatActivityInput): Promise<void> {
  try {
    await cardChatActivityDeps.dispatchEvent({
      type,
      entityId: cardId,
      boardId: null, // [why] Card-chat events are card-scoped, not board-scoped.
      actorId,
      payload: {
        sessionId,
        ...(payload ?? {}),
      },
    });
  } catch (error) {
    // [why] Activity emission must never fail the refinement loop.
    console.error(
      '[cardChat/activities] Failed to emit event:',
      type,
      error instanceof Error ? error.message : String(error)
    );
  }
}
