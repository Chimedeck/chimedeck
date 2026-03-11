import { z } from 'zod';
import type { TriggerHandler } from '../../../common/types';

const configSchema = z.object({
  checklistId: z.string().uuid().optional(),
});

export const cardChecklistCompletedTrigger: TriggerHandler = {
  type: 'card.checklist_completed',
  label: 'Checklist completed on card',
  configSchema,
  matches(event, config) {
    if (event.type !== 'card.checklist_completed') return false;
    const parsed = configSchema.safeParse(config);
    if (!parsed.success) return false;
    const { checklistId } = parsed.data;
    if (checklistId && event.payload['checklistId'] !== checklistId) return false;
    return true;
  },
};
