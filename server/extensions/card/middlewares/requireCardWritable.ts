// Middleware — returns 403 if the target card is archived or the board is ARCHIVED.
import { db } from '../../../common/db';
import type { BoardScopedRequest } from '../../board/middlewares/requireBoardWritable';

export interface CardScopedRequest extends BoardScopedRequest {
  card?: {
    id: string;
    list_id: string;
    title: string;
    description: string | null;
    position: string;
    archived: boolean;
    due_date: string | null;
    created_at: string;
    updated_at: string;
  };
}

// Loads the card by ID, loads its board, and attaches both to the request.
// Returns a Response if not found, board is ARCHIVED, or card is archived; null on success.
export async function requireCardWritable(
  req: CardScopedRequest,
  cardId: string,
): Promise<Response | null> {
  const card = await db('cards').where({ id: cardId }).first();

  if (!card) {
    return Response.json(
      { name: 'card-not-found', data: { message: 'Card not found' } },
      { status: 404 },
    );
  }

  const list = await db('lists').where({ id: card.list_id }).first();
  if (!list) {
    return Response.json(
      { name: 'card-not-found', data: { message: 'Card parent list not found' } },
      { status: 404 },
    );
  }

  const board = await db('boards').where({ id: list.board_id }).first();
  if (!board) {
    return Response.json(
      { name: 'board-not-found', data: { message: 'Board not found' } },
      { status: 404 },
    );
  }

  if (board.state === 'ARCHIVED') {
    return Response.json(
      { name: 'board-archived', data: { message: 'Board is archived and cannot be modified' } },
      { status: 403 },
    );
  }

  if (card.archived) {
    return Response.json(
      { name: 'card-archived', data: { message: 'Card is archived and cannot be modified' } },
      { status: 403 },
    );
  }

  req.card = card;
  req.board = board;
  return null;
}
