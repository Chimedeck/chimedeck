// GET /api/v1/boards/:boardId/members/suggestions?q=<query>
// Returns up to 10 board members whose nickname or name starts with q (case-insensitive).
// The requesting user is excluded from results — you cannot mention yourself.
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { requireBoardAccess, type BoardScopedRequest } from '../../middlewares/requireBoardAccess';
import { buildAvatarProxyUrlsInCollection } from '../../../../common/avatar/resolveAvatarUrl';

export async function handleGetMemberSuggestions(req: Request, boardId: string): Promise<Response> {
  const authReq = req as AuthenticatedRequest;
  const authError = await authenticate(authReq);
  if (authError) return authError;

  const boardReq = req as BoardScopedRequest;
  const accessError = await requireBoardAccess(boardReq, boardId);
  if (accessError) return accessError;

  const currentUserId = authReq.currentUser!.id;
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').toLowerCase().trim();

  const members = await db('users')
    .join('board_members', 'users.id', 'board_members.user_id')
    .where('board_members.board_id', boardId)
    // [deny-first] exclude the requesting user — self-mentions are not meaningful
    .whereNot('users.id', currentUserId)
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

  const data = buildAvatarProxyUrlsInCollection(
    members as Array<{ avatar_url?: string | null } & Record<string, unknown>>,
  );

  return Response.json({ data });
}
