import { z } from 'zod';
import type { TriggerHandler } from '../../../common/types';

const configSchema = z.object({});

export const cardDueDateSetTrigger: TriggerHandler = {
  type: 'card.due_date_set',
  label: 'Due date set on card',
  configSchema,
  matches(event, _config) {
    return event.type === 'card.due_date_set';
  },
};
