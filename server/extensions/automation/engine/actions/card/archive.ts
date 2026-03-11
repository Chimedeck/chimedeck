import { z } from 'zod';
import type { ActionHandler, ActionContext } from '../../../common/types';

const configSchema = z.object({});

export const cardArchiveAction: ActionHandler = {
  type: 'card.archive',
  label: 'Archive card',
  category: 'card',
  configSchema,
  async execute({ evalContext, trx }: ActionContext): Promise<void> {
    const cardId = evalContext.cardId;
    if (!cardId) throw new Error('card-id-missing');

    const card = await trx('cards').where({ id: cardId }).first();
    if (!card) throw new Error('card-not-found');

    await trx('cards')
      .where({ id: cardId })
      .update({ archived: true, updated_at: new Date().toISOString() });
  },
};
