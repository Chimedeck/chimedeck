// GET /api/v1/boards/:id/view-preference
// Returns the current user's saved view type for this board.
// Defaults to KANBAN if no preference has been saved yet.
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { db } from '../../../common/db';
import { getViewPreference } from '../model';

export async function handleGetViewPreference(req: Request, boardId: string): Promise<Response> {
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

  const pref = await getViewPreference({ userId, boardId });
  const viewType = pref?.view_type ?? 'KANBAN';

  return Response.json({ data: { viewType } });
}
