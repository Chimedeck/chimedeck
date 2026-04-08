import { z } from 'zod';
import type { TriggerHandler } from '../../../common/types';

const configSchema = z.object({
  listId: z.string().min(1),
});

export const cardMovedToListTrigger: TriggerHandler = {
  type: 'card.moved_to_list',
  label: 'Card moved to list',
  configSchema,
  matches(event, config) {
    if (event.type !== 'card.moved') return false;
    const parsed = configSchema.safeParse(config);
    if (!parsed.success) return false;
    return event.payload['toListId'] === parsed.data.listId;
  },
};
