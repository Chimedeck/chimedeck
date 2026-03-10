// POST /api/v1/boards/:id/follow — follow a board for the current user (idempotent).
// DELETE /api/v1/boards/:id/follow — unfollow a board for the current user (idempotent).
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';

export async function handleFollowBoard(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const userId = (req as AuthenticatedRequest).currentUser!.id;

  const board = await db('boards').where({ id: boardId }).first();
  if (!board) {
    return Response.json(
      { name: 'board-not-found', data: { message: 'Board not found' } },
      { status: 404 },
    );
  }

  // Idempotent insert — ignore conflict on duplicate primary key
  await db('board_followers')
    .insert({ user_id: userId, board_id: boardId })
    .onConflict(['user_id', 'board_id'])
    .ignore();

  return Response.json({ data: { board_id: boardId, user_id: userId, following: true } });
}

export async function handleUnfollowBoard(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const userId = (req as AuthenticatedRequest).currentUser!.id;

  const board = await db('boards').where({ id: boardId }).first();
  if (!board) {
    return Response.json(
      { name: 'board-not-found', data: { message: 'Board not found' } },
      { status: 404 },
    );
  }

  // Idempotent delete — no error if row doesn't exist
  await db('board_followers').where({ user_id: userId, board_id: boardId }).delete();

  return Response.json({ data: { board_id: boardId, user_id: userId, following: false } });
}
