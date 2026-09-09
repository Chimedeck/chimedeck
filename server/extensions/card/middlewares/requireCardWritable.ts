// Middleware — returns 403 if the target card is archived or the board is ARCHIVED.
import { db } from '../../../common/db';
import type { BoardScopedRequest, ScopedBoardRow } from '../../board/middlewares/requireBoardWritable';

// Core card columns from 0006_card.ts; timestamps are nullable and PostgreSQL
// returns Date values, while serialized fixtures may use strings.
interface ScopedCardRow {
  id: string;
  list_id: string;
  title: string;
  description: string | null;
  position: string;
  archived: boolean;
  due_date: Date | string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

// Parent lookup columns from 0005_list.ts.
interface CardParentListRow {
  id: string;
  board_id: string;
}

export interface CardScopedRequest extends BoardScopedRequest {
  card?: ScopedCardRow;
}

// Loads the card by ID, loads its board, and attaches both to the request.
// Returns a Response if not found, board is ARCHIVED, or card is archived; null on success.
export async function requireCardWritable(
  req: CardScopedRequest,
  cardId: string,
): Promise<Response | null> {
  const card = await db<ScopedCardRow>('cards').where({ id: cardId }).first();

  if (!card) {
    return Response.json(
      { error: { code: 'card-not-found', message: 'Card not found' } },
      { status: 404 },
    );
  }

  const list = await db<CardParentListRow>('lists').where({ id: card.list_id }).first();
  if (!list) {
    return Response.json(
      { error: { code: 'card-not-found', message: 'Card parent list not found' } },
      { status: 404 },
    );
  }

  const board = await db<ScopedBoardRow>('boards').where({ id: list.board_id }).first();
  if (!board) {
    return Response.json(
      { error: { code: 'board-not-found', message: 'Board not found' } },
      { status: 404 },
    );
  }

  if (board.state === 'ARCHIVED') {
    return Response.json(
      { error: { code: 'board-is-archived', message: 'This board is archived and cannot be modified.' } },
      { status: 403 },
    );
  }

  if (card.archived) {
    return Response.json(
      { error: { code: 'card-archived', message: 'Card is archived and cannot be modified' } },
      { status: 403 },
    );
  }

  req.card = card;
  req.board = board;
  return null;
}
