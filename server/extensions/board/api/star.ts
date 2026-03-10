// POST /api/v1/boards/:id/star — star a board for the current user (idempotent).
// DELETE /api/v1/boards/:id/star — unstar a board for the current user (idempotent).
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';

export async function handleStarBoard(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const userId = (req as AuthenticatedRequest).currentUser!.id;

  const board = await db('boards').where({ id: boardId }).first();
  if (!board) {
    return Response.json(
      { error: { code: 'board-not-found', message: 'Board not found' } },
      { status: 404 },
    );
  }

  // Idempotent insert — ignore conflict on duplicate primary key
  await db('board_stars')
    .insert({ user_id: userId, board_id: boardId })
    .onConflict(['user_id', 'board_id'])
    .ignore();

  return Response.json({ data: { board_id: boardId, user_id: userId, starred: true } });
}

export async function handleUnstarBoard(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const userId = (req as AuthenticatedRequest).currentUser!.id;

  const board = await db('boards').where({ id: boardId }).first();
  if (!board) {
    return Response.json(
      { error: { code: 'board-not-found', message: 'Board not found' } },
      { status: 404 },
    );
  }

  // Idempotent delete — no error if row doesn't exist
  await db('board_stars').where({ user_id: userId, board_id: boardId }).delete();

  return Response.json({ data: { board_id: boardId, user_id: userId, starred: false } });
}
