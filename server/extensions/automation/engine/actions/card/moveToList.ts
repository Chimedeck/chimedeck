import { z } from 'zod';
import { between, HIGH_SENTINEL } from '../../../../list/mods/fractional';
import { broadcast } from '../../../../realtime/mods/rooms/broadcast';
import type { ActionHandler, ActionContext } from '../../../common/types';

// Consumed/filter columns from migrations 0006_card and 0005_list.
// The full card is still read and spread into the existing broadcast payload.
interface MoveCardRow {
  id: string;
  list_id: string;
  position: string;
  archived: boolean;
}

interface TargetListRow {
  id: string;
  board_id: string;
}

const configSchema = z.object({
  listId: z.string().min(1),
  position: z.enum(['top', 'bottom']).optional(),
});

export const cardMoveToListAction: ActionHandler = {
  type: 'card.move_to_list',
  label: 'Move card to list',
  category: 'card',
  configSchema,
  async execute({
    action,
    evalContext,
    automation,
    trx,
    postCommit,
  }: ActionContext): Promise<void> {
    const config = configSchema.parse(action.config);
    const cardId = evalContext.cardId;
    if (!cardId) throw new Error('card-id-missing');

    const card = await trx<MoveCardRow>('cards').where({ id: cardId }).first();
    if (!card) throw new Error('card-not-found');

    const targetList = await trx<TargetListRow>('lists').where({ id: config.listId }).first();
    if (!targetList) throw new Error('target-list-not-found');

    // Guard: the target list must belong to the same board as the automation.
    if (targetList.board_id !== automation.board_id)
      throw new Error('target-list-on-different-board');

    const targetCards = await trx<MoveCardRow>('cards')
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

    // Broadcast card_moved after the transaction commits so the board UI updates in real time.
    const fromListId = card.list_id;
    const boardId = automation.board_id;
    const movedCard = { ...card, list_id: config.listId, position };
    postCommit(() => {
      broadcast({
        boardId,
        message: JSON.stringify({ type: 'card_moved', payload: { card: movedCard, fromListId } }),
      });
    });
  },
};
