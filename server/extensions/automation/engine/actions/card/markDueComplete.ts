import { z } from 'zod';
import type { ActionHandler, ActionContext } from '../../../common/types';

const configSchema = z.object({});

export const cardMarkDueCompleteAction: ActionHandler = {
  type: 'card.mark_due_complete',
  label: 'Mark due date as complete',
  category: 'card',
  configSchema,
  async execute({ evalContext, trx }: ActionContext): Promise<void> {
    const cardId = evalContext.cardId;
    if (!cardId) throw new Error('card-id-missing');

    const card = await trx('cards').where({ id: cardId }).first();
    if (!card) throw new Error('card-not-found');
    if (!card.due_date) throw new Error('card-has-no-due-date');

    await trx('cards')
      .where({ id: cardId })
      .update({ due_complete: true, updated_at: new Date().toISOString() });
  },
};
