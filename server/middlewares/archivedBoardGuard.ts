// archivedBoardGuard.ts — returns 403 board-is-archived if the board is in ARCHIVED state.
// Use this helper inside any mutation handler that resolves a board.
import { db } from '../common/db';

// Returns a 403 Response if the board (by id) is archived, null otherwise.
// Also returns 404 if the board is not found.
export async function requireBoardNotArchived(boardId: string): Promise<Response | null> {
  const board = await db('boards').where({ id: boardId }).first();

  if (!board) {
    return Response.json(
      { error: { code: 'board-not-found', message: 'Board not found' } },
      { status: 404 },
    );
  }

  if (board.state === 'ARCHIVED') {
    return Response.json(
      {
        error: {
          code: 'board-is-archived',
          message: 'This board is archived and cannot be modified.',
        },
      },
      { status: 403 },
    );
  }

  return null;
}

// Convenience: resolve board from a cardId and return 403 if archived.
// Returns { error: Response } on failure or { board } on success.
export async function resolveBoardFromCard(
  cardId: string,
): Promise<{ error: Response } | { board: Record<string, unknown> }> {
  const card = await db('cards').where({ id: cardId }).first();
  if (!card) {
    return {
      error: Response.json(
        { error: { code: 'card-not-found', message: 'Card not found' } },
        { status: 404 },
      ),
    };
  }

  const list = await db('lists').where({ id: card.list_id }).first();
  if (!list) {
    return {
      error: Response.json(
        { error: { code: 'card-not-found', message: 'Card parent list not found' } },
        { status: 404 },
      ),
    };
  }

  const board = await db('boards').where({ id: list.board_id }).first();
  if (!board) {
    return {
      error: Response.json(
        { error: { code: 'board-not-found', message: 'Board not found' } },
        { status: 404 },
      ),
    };
  }

  if (board.state === 'ARCHIVED') {
    return {
      error: Response.json(
        {
          error: {
            code: 'board-is-archived',
            message: 'This board is archived and cannot be modified.',
          },
        },
        { status: 403 },
      ),
    };
  }

  return { board };
}

// Convenience: resolve board from a commentId and return 403 if archived.
export async function resolveBoardFromComment(
  commentId: string,
): Promise<{ error: Response } | { board: Record<string, unknown> }> {
  const comment = await db('comments').where({ id: commentId }).first();
  if (!comment) {
    return {
      error: Response.json(
        { error: { code: 'comment-not-found', message: 'Comment not found' } },
        { status: 404 },
      ),
    };
  }

  return resolveBoardFromCard(comment.card_id as string);
}
