import { z } from 'zod';
import type { ActionHandler, ActionContext } from '../../../common/types';

const configSchema = z.object({});

export const cardRemoveDueDateAction: ActionHandler = {
  type: 'card.remove_due_date',
  label: 'Remove due date from card',
  category: 'card',
  configSchema,
  async execute({ evalContext, trx }: ActionContext): Promise<void> {
    const cardId = evalContext.cardId;
    if (!cardId) throw new Error('card-id-missing');

    await trx('cards')
      .where({ id: cardId })
      .update({ due_date: null, due_complete: false, updated_at: new Date().toISOString() });
  },
};
