import { z } from 'zod';
import type { ActionHandler, ActionContext } from '../../../common/types';

// Existence-check row: id is the string primary key in db/migrations/0006_card.ts.
interface CardIdentityRow {
  id: string;
}

const configSchema = z.object({});

export const cardArchiveAction: ActionHandler = {
  type: 'card.archive',
  label: 'Archive card',
  category: 'card',
  configSchema,
  async execute({ evalContext, trx }: ActionContext): Promise<void> {
    const cardId = evalContext.cardId;
    if (!cardId) throw new Error('card-id-missing');

    const card = await trx<CardIdentityRow>('cards').where({ id: cardId }).first();
    if (!card) throw new Error('card-not-found');

    await trx('cards')
      .where({ id: cardId })
      .update({ archived: true, updated_at: new Date().toISOString() });
  },
};
