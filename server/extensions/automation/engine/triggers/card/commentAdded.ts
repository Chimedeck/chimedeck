import { z } from 'zod';
import type { TriggerHandler } from '../../../common/types';

const configSchema = z.object({});

export const cardCommentAddedTrigger: TriggerHandler = {
  type: 'card.comment_added',
  label: 'Comment added to card',
  configSchema,
  matches(event, _config) {
    return event.type === 'card.comment_added';
  },
};
