// list.move_all_cards — moves all non-archived cards from one list to another.
// Cards are appended to the bottom of the target list, preserving their relative order.

import { z } from 'zod';
import { between, HIGH_SENTINEL } from '../../../../list/mods/fractional';
import type { ActionHandler, ActionContext } from '../../../common/types';

const configSchema = z.object({
  fromListId: z.string().min(1),
  toListId: z.string().min(1),
});

type ListRow = { board_id: string };
type CardRow = { id: string; position: string };

export const listMoveAllCardsAction: ActionHandler = {
  type: 'list.move_all_cards',
  label: 'Move all cards to another list',
  category: 'list',
  configSchema,
  async execute({ action, automation, trx }: ActionContext): Promise<void> {
    const config = configSchema.parse((action as { config: unknown }).config);
    const transaction = trx;
    const automationBoardId = (automation as { board_id: string }).board_id;

    if (config.fromListId === config.toListId) return;

    const fromList = (await transaction('lists').where({ id: config.fromListId }).first()) as ListRow | undefined;
    if (!fromList) throw new Error('from-list-not-found');

    // Guard: both lists must belong to the same board as the automation.
    if (fromList.board_id !== automationBoardId) throw new Error('from-list-on-different-board');

    const toList = (await transaction('lists').where({ id: config.toListId }).first()) as ListRow | undefined;
    if (!toList) throw new Error('to-list-not-found');

    if (toList.board_id !== automationBoardId) throw new Error('to-list-on-different-board');

    const movingCards = (await transaction('cards')
      .where({ list_id: config.fromListId, archived: false })
      .orderBy('position', 'asc')) as CardRow[];

    if (movingCards.length === 0) return;

    // Find the current last position in the target list to append after.
    const lastTargetCard = (await transaction('cards')
      .where({ list_id: config.toListId, archived: false })
      .orderBy('position', 'desc')
      .first()) as CardRow | undefined;

    let prev = lastTargetCard ? lastTargetCard.position : '';

    for (const card of movingCards) {
      const newPos = between(prev, HIGH_SENTINEL);
      await transaction('cards')
        .where({ id: card.id })
        .update({ list_id: config.toListId, position: newPos, updated_at: new Date().toISOString() });
      prev = newPos;
    }
  },
};
