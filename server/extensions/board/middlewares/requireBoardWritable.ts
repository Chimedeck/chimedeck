// Middleware — returns 403 if the target board is ARCHIVED, preventing all mutations.
import { db } from '../../../common/db';

// Core board columns from db/migrations/0004_board.ts. The timestamp is nullable;
// PostgreSQL normally returns Date, while serialized fixtures may use strings.
export interface ScopedBoardRow {
  id: string;
  workspace_id: string;
  title: string;
  state: 'ACTIVE' | 'ARCHIVED';
  created_at: Date | string | null;
}

export interface BoardScopedRequest extends Request {
  board?: ScopedBoardRow;
}

// Loads the board by ID and attaches it to the request.
// Returns a Response if the board is not found or is ARCHIVED, null on success.
export async function requireBoardWritable(
  req: BoardScopedRequest,
  boardId: string,
): Promise<Response | null> {
  const board = await db<ScopedBoardRow>('boards').where({ id: boardId }).first();

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

  req.board = board;
  return null;
}
