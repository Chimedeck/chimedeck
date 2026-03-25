import { z } from 'zod';
import type { TriggerHandler } from '../../../common/types';

const configSchema = z.object({
  labelId: z.string().min(1).optional(),
});

export const cardLabelRemovedTrigger: TriggerHandler = {
  type: 'card.label_removed',
  label: 'Label removed from card',
  configSchema,
  matches(event, config) {
    if (event.type !== 'card.label_removed') return false;
    const parsed = configSchema.safeParse(config);
    if (!parsed.success) return false;
    const { labelId } = parsed.data;
    if (labelId && event.payload['labelId'] !== labelId) return false;
    return true;
  },
};
