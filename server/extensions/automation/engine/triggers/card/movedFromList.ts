import { z } from 'zod';
import type { TriggerHandler } from '../../../common/types';

const configSchema = z.object({
  listId: z.string().uuid(),
});

export const cardMovedFromListTrigger: TriggerHandler = {
  type: 'card.moved_from_list',
  label: 'Card moved from list',
  configSchema,
  matches(event, config) {
    if (event.type !== 'card.moved') return false;
    const parsed = configSchema.safeParse(config);
    if (!parsed.success) return false;
    return event.payload['fromListId'] === parsed.data.listId;
  },
};
