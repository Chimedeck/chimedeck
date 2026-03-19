import { z } from 'zod';
import { between, HIGH_SENTINEL } from '../../../../list/mods/fractional';
import type { ActionHandler, ActionContext } from '../../../common/types';

const configSchema = z.object({});

export const cardMoveToTopAction: ActionHandler = {
  type: 'card.move_to_top',
  label: 'Move card to top of list',
  category: 'card',
  configSchema,
  async execute({ evalContext, trx }: ActionContext): Promise<void> {
    const cardId = evalContext.cardId;
    if (!cardId) throw new Error('card-id-missing');

    const card = await trx('cards').where({ id: cardId }).first();
    if (!card) throw new Error('card-not-found');

    const firstCard = await trx('cards')
      .where({ list_id: card.list_id, archived: false })
      .whereNot({ id: cardId })
      .orderBy('position', 'asc')
      .first();

    const position = between('', firstCard ? firstCard.position : HIGH_SENTINEL);

    await trx('cards')
      .where({ id: cardId })
      .update({ position, updated_at: new Date().toISOString() });
  },
};
