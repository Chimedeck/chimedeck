import { z } from 'zod';
import type { TriggerHandler } from '../../../common/types';

const configSchema = z.object({});

export const cardArchivedTrigger: TriggerHandler = {
  type: 'card.archived',
  label: 'Card archived',
  configSchema,
  matches(event, _config) {
    return event.type === 'card.archived';
  },
};
