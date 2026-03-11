import { z } from 'zod';
import { between, HIGH_SENTINEL } from '../../../../list/mods/fractional';
import type { ActionHandler, ActionContext } from '../../../common/types';

const configSchema = z.object({
  listId: z.string().uuid(),
  position: z.enum(['top', 'bottom']).optional(),
});

export const cardMoveToListAction: ActionHandler = {
  type: 'card.move_to_list',
  label: 'Move card to list',
  category: 'card',
  configSchema,
  async execute({ action, evalContext, trx }: ActionContext): Promise<void> {
    const config = configSchema.parse(action.config);
    const cardId = evalContext.cardId;
    if (!cardId) throw new Error('card-id-missing');

    const card = await trx('cards').where({ id: cardId }).first();
    if (!card) throw new Error('card-not-found');

    const targetList = await trx('lists').where({ id: config.listId }).first();
    if (!targetList) throw new Error('target-list-not-found');

    const targetCards = await trx('cards')
      .where({ list_id: config.listId, archived: false })
      .whereNot({ id: cardId })
      .orderBy('position', 'asc');

    let position: string;
    if (config.position === 'top') {
      const first = targetCards[0];
      position = between('', first ? first.position : HIGH_SENTINEL);
    } else {
      // default: bottom
      const last = targetCards[targetCards.length - 1];
      position = between(last ? last.position : '', HIGH_SENTINEL);
    }

    await trx('cards')
      .where({ id: cardId })
      .update({ list_id: config.listId, position, updated_at: new Date().toISOString() });
  },
};
