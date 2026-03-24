// server/mods/events/dispatch.ts
// Writes an event and fire-and-forget triggers automation evaluation and
// board activity email notifications. Failures in either downstream hook are
// swallowed and must never block card mutations.

import { writeEvent, type WriteEventInput, type WrittenEvent } from './index';
import { automationConfig } from '../../extensions/automation/config';
import { handleBoardActivityNotification } from '../../extensions/notifications/mods/boardActivityDispatch';

export async function dispatchEvent(input: WriteEventInput): Promise<WrittenEvent> {
  const event = await writeEvent(input);

  // Fire-and-forget automation evaluation — must not block or throw.
  if (automationConfig.enabled && event.board_id) {
    import('../../extensions/automation/engine/index')
      .then(({ evaluate }) =>
        evaluate({
          boardId: event.board_id as string,
          event: {
            type: event.type,
            boardId: event.board_id as string,
            entityId: event.entity_id,
            actorId: event.actor_id,
            payload: event.payload,
          },
          context: {
            actorId: event.actor_id,
            // For card.* events, entityId is the card ID — actions need it.
            ...(event.type.startsWith('card.') ? { cardId: event.entity_id } : {}),
          },
        }),
      )
      .catch(() => {
        // Automation errors must never propagate to the caller.
      });
  }

  // Fire-and-forget board activity email notifications.
  // Handles card.created and card.moved events (comment_added is dispatched directly from create.ts).
  if (event.board_id && event.actor_id) {
    handleBoardActivityNotification({
      event,
      boardId: event.board_id,
      actorId: event.actor_id,
    }).catch(() => {
      // Notification errors must never propagate to the caller.
    });
  }

  return event;
}
