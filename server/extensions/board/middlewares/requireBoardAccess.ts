// Middleware — loads the board by ID and attaches it to the request.
// Does NOT restrict archived boards (read access is always allowed).
import { db } from '../../../common/db';

export type { BoardScopedRequest } from './requireBoardWritable';

import type { BoardScopedRequest } from './requireBoardWritable';

export async function requireBoardAccess(
  req: BoardScopedRequest,
  boardId: string,
): Promise<Response | null> {
  const board = await db('boards').where({ id: boardId }).first();

  if (!board) {
    return Response.json(
      { error: { code: 'board-not-found', message: 'Board not found' } },
      { status: 404 },
    );
  }

  req.board = board;
  return null;
}
