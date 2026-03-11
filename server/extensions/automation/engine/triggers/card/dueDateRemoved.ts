import { z } from 'zod';
import type { TriggerHandler } from '../../../common/types';

const configSchema = z.object({});

export const cardDueDateRemovedTrigger: TriggerHandler = {
  type: 'card.due_date_removed',
  label: 'Due date removed from card',
  configSchema,
  matches(event, _config) {
    return event.type === 'card.due_date_removed';
  },
};
