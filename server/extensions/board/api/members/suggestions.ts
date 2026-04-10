// GET /api/v1/boards/:boardId/members/suggestions?q=<query>
// Returns up to 10 board participants (members + guests) whose nickname or name
// starts with q (case-insensitive).
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

  const currentUserId = authReq.currentUser?.id;
  if (!currentUserId) {
    return Response.json(
      { error: { code: 'unauthorized', message: 'Authentication required' } },
      { status: 401 },
    );
  }
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').toLowerCase().trim();

  const members = await db('users')
    // [deny-first] exclude the requesting user — self-mentions are not meaningful
    .whereNot('users.id', currentUserId)
    // [why] Mentions should include everyone who can participate on this board,
    // including board-scoped guests.
    .where((builder) => {
      builder
        .whereExists(
          db('board_members')
            .select(db.raw('1'))
            .whereRaw('board_members.user_id = users.id')
            .andWhere('board_members.board_id', boardId),
        )
        .orWhereExists(
          db('board_guest_access')
            .select(db.raw('1'))
            .whereRaw('board_guest_access.user_id = users.id')
            .andWhere('board_guest_access.board_id', boardId),
        );
    })
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
