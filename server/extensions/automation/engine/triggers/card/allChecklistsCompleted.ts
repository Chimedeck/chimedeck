import { z } from 'zod';
import type { TriggerHandler } from '../../../common/types';

const configSchema = z.object({});

export const cardAllChecklistsCompletedTrigger: TriggerHandler = {
  type: 'card.all_checklists_completed',
  label: 'All checklists completed on card',
  configSchema,
  matches(event, _config) {
    return event.type === 'card.all_checklists_completed';
  },
};
