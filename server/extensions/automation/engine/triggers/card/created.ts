import { z } from 'zod';
import type { TriggerHandler } from '../../../common/types';

const configSchema = z.object({
  listId: z.string().min(1).optional(),
});

export const cardCreatedTrigger: TriggerHandler = {
  type: 'card.created',
  label: 'Card created',
  configSchema,
  matches(event, config) {
    if (event.type !== 'card.created') return false;
    const parsed = configSchema.safeParse(config);
    if (!parsed.success) return false;
    const { listId } = parsed.data;
    if (listId && event.payload['listId'] !== listId) return false;
    return true;
  },
};
