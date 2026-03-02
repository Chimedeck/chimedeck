// Deep-copy a board: creates new board + lists + cards inside a single DB transaction.
// Labels, checklist items, and comments are NOT copied (sprint 07/10 scope).
import { randomUUID } from 'crypto';
import { db } from '../../../../common/db';

export interface DuplicateBoardParams {
  originalBoardId: string;
  workspaceId: string;
  originalTitle: string;
}

export interface DuplicateBoardResult {
  status: number;
  data?: { id: string; workspace_id: string; title: string; state: string; created_at: string };
  name?: string;
}

export async function duplicateBoard({
  originalBoardId,
  workspaceId,
  originalTitle,
}: DuplicateBoardParams): Promise<DuplicateBoardResult> {
  try {
    const newBoardId = randomUUID();

    await db.transaction(async (trx) => {
      // 1. Create new board with ACTIVE state.
      await trx('boards').insert({
        id: newBoardId,
        workspace_id: workspaceId,
        title: `Copy of ${originalTitle}`,
        state: 'ACTIVE',
      });

      // 2. Check if lists table exists (available from sprint 06 onwards).
      const hasLists = await trx.schema.hasTable('lists');
      if (!hasLists) return;

      const lists = await trx('lists')
        .where({ board_id: originalBoardId })
        .orderBy('position', 'asc');

      for (const list of lists) {
        const newListId = randomUUID();
        await trx('lists').insert({
          id: newListId,
          board_id: newBoardId,
          title: list.title,
          position: list.position,
        });

        // 3. Copy cards for this list (available from sprint 07 onwards).
        const hasCards = await trx.schema.hasTable('cards');
        if (!hasCards) continue;

        const cards = await trx('cards')
          .where({ list_id: list.id })
          .orderBy('position', 'asc');

        for (const card of cards) {
          await trx('cards').insert({
            id: randomUUID(),
            list_id: newListId,
            title: card.title,
            description: card.description,
            position: card.position,
            archived: false,
          });
        }
      }
    });

    const newBoard = await db('boards').where({ id: newBoardId }).first();
    return { status: 201, data: newBoard };
  } catch (err) {
    console.error('[board/duplicate] transaction failed', err);
    return {
      status: 500,
      name: 'board-duplicate-failed',
    };
  }
}
