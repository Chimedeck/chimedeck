import { z } from 'zod';
import type { TriggerHandler } from '../../../common/types';

// Fires when any card lands in a specific list — whether by creation or move.
const configSchema = z.object({
  listId: z.string().uuid(),
});

export const listCardAddedTrigger: TriggerHandler = {
  type: 'list.card_added',
  label: 'Card added to list',
  configSchema,
  matches(event, config) {
    // Fires on card.created (listId in payload) or card.moved (toListId in payload).
    if (event.type !== 'card.created' && event.type !== 'card.moved') return false;
    const parsed = configSchema.safeParse(config);
    if (!parsed.success) return false;
    const { listId } = parsed.data;
    const targetList =
      event.type === 'card.moved' ? event.payload['toListId'] : event.payload['listId'];
    return targetList === listId;
  },
};
