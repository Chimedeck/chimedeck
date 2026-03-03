// GET /api/v1/boards/:boardId/members/suggestions?q=<query>
// Returns up to 10 board members whose nickname or name starts with q (case-insensitive).
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { requireBoardAccess, type BoardScopedRequest } from '../../middlewares/requireBoardAccess';

export async function handleGetMemberSuggestions(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardReq = req as BoardScopedRequest;
  const accessError = await requireBoardAccess(boardReq, boardId);
  if (accessError) return accessError;

  const board = boardReq.board!;
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').toLowerCase().trim();

  const members = await db('users')
    .join('memberships', 'users.id', 'memberships.user_id')
    .where('memberships.workspace_id', board.workspace_id)
    .where((builder) => {
      if (q) {
        builder
          .whereRaw('LOWER(users.nickname) LIKE ?', [`${q}%`])
          .orWhereRaw('LOWER(COALESCE(users.name, users.email)) LIKE ?', [`${q}%`]);
      }
    })
    .select(
      'users.id',
      'users.nickname',
      db.raw("COALESCE(users.name, users.email) as name"),
      'users.avatar_url',
    )
    .limit(10);

  return Response.json({ data: members });
}
