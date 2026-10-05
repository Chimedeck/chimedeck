import { z } from 'zod';
import { between, HIGH_SENTINEL } from '../../../../list/mods/fractional';
import type { ActionHandler, ActionContext } from '../../../common/types';

// Non-null columns from db/migrations/0006_card.ts used by these queries.
interface CardPositionRow {
  id: string;
  list_id: string;
  position: string;
  archived: boolean;
}

const configSchema = z.object({});

export const cardMoveToBottomAction: ActionHandler = {
  type: 'card.move_to_bottom',
  label: 'Move card to bottom of list',
  category: 'card',
  configSchema,
  async execute({ evalContext, trx }: ActionContext): Promise<void> {
    const cardId = evalContext.cardId;
    if (!cardId) throw new Error('card-id-missing');

    const card = await trx<CardPositionRow>('cards').where({ id: cardId }).first();
    if (!card) throw new Error('card-not-found');

    const lastCard = await trx<CardPositionRow>('cards')
      .where({ list_id: card.list_id, archived: false })
      .whereNot({ id: cardId })
      .orderBy('position', 'desc')
      .first();

    const position = between(lastCard ? lastCard.position : '', HIGH_SENTINEL);

    await trx('cards')
      .where({ id: cardId })
      .update({ position, updated_at: new Date().toISOString() });
  },
};
