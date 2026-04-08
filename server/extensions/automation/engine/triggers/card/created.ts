import { z } from 'zod';
import type { TriggerHandler } from '../../../common/types';

const configSchema = z.object({
  // Empty array or omitted means "any list".
  listIds: z.array(z.string().min(1)).optional(),
});

export const cardCreatedTrigger: TriggerHandler = {
  type: 'card.created',
  label: 'Card created',
  configSchema,
  matches(event, config) {
    if (event.type !== 'card.created') return false;
    const parsed = configSchema.safeParse(config);
    if (!parsed.success) return false;
    const { listIds } = parsed.data;
    if (listIds && listIds.length > 0 && !listIds.includes(event.payload['listId'] as string)) return false;
    return true;
  },
};
