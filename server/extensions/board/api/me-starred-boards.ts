// GET /api/v1/me/starred-boards — list all boards starred by the current user.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';

export async function handleGetMeStarredBoards(req: Request): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const userId = (req as AuthenticatedRequest).currentUser!.id;

  const boards = await db('boards as b')
    .join('board_stars as bs', function () {
      this.on('bs.board_id', '=', 'b.id').andOn('bs.user_id', '=', db.raw('?', [userId]));
    })
    .select('b.*', db.raw('true as "isStarred"'))
    .orderBy('bs.created_at', 'asc');

  return Response.json({ data: boards });
}
