import { z } from 'zod';
import type { ActionHandler, ActionContext } from '../../../common/types';

// Read projection from db/migrations/0006_card.ts (due_date is nullable).
interface CardDueDateRow {
  id: string;
  due_date: Date | null;
}

const configSchema = z.object({});

export const cardMarkDueCompleteAction: ActionHandler = {
  type: 'card.mark_due_complete',
  label: 'Mark due date as complete',
  category: 'card',
  configSchema,
  async execute({ evalContext, trx }: ActionContext): Promise<void> {
    const cardId = evalContext.cardId;
    if (!cardId) throw new Error('card-id-missing');

    const card = await trx<CardDueDateRow>('cards').where({ id: cardId }).first();
    if (!card) throw new Error('card-not-found');
    if (!card.due_date) throw new Error('card-has-no-due-date');

    await trx('cards')
      .where({ id: cardId })
      .update({ due_complete: true, updated_at: new Date().toISOString() });
  },
};
