// card.copy_to_board — copies the triggering card to a list on another board.
//
// Permission rule (enforced at execution time):
//   The ACTOR (evalContext.actorId — the user who triggered the rule) must be a
//   workspace MEMBER, ADMIN, or OWNER of the target board's workspace.
//   If the actor lacks access, the action throws and the run is recorded as FAILED/PARTIAL.
//   This means the same automation can fire for different users with different outcomes —
//   it only succeeds for users who actually have write access to the target board.

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { between, HIGH_SENTINEL } from '../../../../list/mods/fractional';
import { broadcast } from '../../../../realtime/mods/rooms/broadcast';
import { dispatchEvent } from '../../../../../mods/events/dispatch';
import type { ActionHandler, ActionContext } from '../../../common/types';

const configSchema = z.object({
  targetBoardId: z.string().uuid(),
  targetListId: z.string().uuid(),
  position: z.enum(['top', 'bottom']).optional(),
});

export const cardCopyToBoardAction: ActionHandler = {
  type: 'card.copy_to_board',
  label: 'Copy card to another board',
  category: 'card',
  configSchema,
  async execute({ action, evalContext, trx, postCommit }: ActionContext): Promise<void> {
    const config = configSchema.parse(action.config);
    const cardId = evalContext.cardId;
    if (!cardId) throw new Error('card-id-missing');

    const actorId = evalContext.actorId;

    // Load the source card.
    const card = await trx('cards').where({ id: cardId }).first();
    if (!card) throw new Error('card-not-found');

    // Load the target board and verify it exists.
    const targetBoard = await trx('boards').where({ id: config.targetBoardId }).first();
    if (!targetBoard) throw new Error('target-board-not-found');

    // Enforce actor access: the triggering user must be a MEMBER+ of the target board's workspace.
    // This keeps automations user-specific — the same rule only works if the actor can actually
    // write to the target board. GUESTs (rank 0) are read-only and cannot trigger copy actions.
    const actorMembership = await trx('memberships')
      .where({ user_id: actorId, workspace_id: targetBoard.workspace_id })
      .first();
    if (!actorMembership || !['OWNER', 'ADMIN', 'MEMBER'].includes(actorMembership.role)) {
      throw new Error('actor-lacks-target-board-access');
    }

    // Verify the target list belongs to the target board.
    const targetList = await trx('lists')
      .where({ id: config.targetListId, board_id: config.targetBoardId })
      .first();
    if (!targetList) throw new Error('target-list-not-found');

    // Compute position in the target list.
    const targetCards = await trx('cards')
      .where({ list_id: config.targetListId, archived: false })
      .orderBy('position', 'asc');

    let position: string;
    if (config.position === 'top') {
      const first = targetCards.at(0);
      position = between('', first ? first.position : HIGH_SENTINEL);
    } else {
      const last = targetCards.at(-1);
      position = between(last ? last.position : '', HIGH_SENTINEL);
    }

    // Insert the copied card on the target board.
    const newCardId = randomUUID();
    await trx('cards').insert({
      id: newCardId,
      list_id: config.targetListId,
      title: card.title,
      description: card.description ?? null,
      position,
      archived: false,
      due_date: card.due_date ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const newCard = await trx('cards').where({ id: newCardId }).first();

    // Fire event + broadcast for the target board after commit so triggers and
    // websocket clients on the target board are notified. The actorId is used as-is
    // so activity logs show it was this specific user who created the card.
    postCommit(() => {
      dispatchEvent({
        type: 'card.created',
        boardId: config.targetBoardId,
        entityId: newCardId,
        actorId,
        payload: { copiedFromCardId: cardId, copiedFromBoardId: action.config.sourceBoardId ?? null },
      });

      broadcast({
        boardId: config.targetBoardId,
        message: JSON.stringify({ type: 'card_created', payload: { card: newCard } }),
      });
    });
  },
};
