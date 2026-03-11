// server/mods/events/dispatch.ts
// Writes an event and fire-and-forget triggers automation evaluation.
// Automation failures are swallowed here and must never block card mutations.

import { writeEvent, type WriteEventInput, type WrittenEvent } from './index';
import { automationConfig } from '../../extensions/automation/config';

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
          context: { actorId: event.actor_id },
        }),
      )
      .catch(() => {
        // Automation errors must never propagate to the caller.
      });
  }

  return event;
}
