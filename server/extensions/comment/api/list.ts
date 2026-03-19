// GET /api/v1/cards/:id/comments — list comments for a card; min role: MEMBER.
import { db } from '../../../common/db';
import { resolveAvatarUrl } from '../../../common/avatar/resolveAvatarUrl';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';

export async function handleListComments(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const card = await db('cards').where({ id: cardId }).first();
  if (!card) {
    return Response.json(
      { error: { code: 'card-not-found', message: 'Card not found' } },
      { status: 404 },
    );
  }

  const list = await db('lists').where({ id: card.list_id }).first();
  const board = list ? await db('boards').where({ id: list.board_id }).first() : null;
  if (!board) {
    return Response.json(
      { error: { code: 'board-not-found', message: 'Board not found' } },
      { status: 404 },
    );
  }

  // Verify workspace membership
  const membershipError = await requireWorkspaceMembership(
    req as WorkspaceScopedRequest,
    board.workspace_id,
  );
  if (membershipError) return membershipError;

  const comments = await db('comments')
    .leftJoin('users', 'comments.user_id', 'users.id')
    .where('comments.card_id', cardId)
    .orderBy('comments.created_at', 'asc')
    .select(
      'comments.id',
      'comments.card_id',
      'comments.user_id',
      'comments.content',
      'comments.version',
      'comments.deleted',
      'comments.created_at',
      'comments.updated_at',
      db.raw("COALESCE(users.name, users.email) as author_name"),
      'users.email as author_email',
      'users.avatar_url as author_avatar_url',
    );

  const data = await Promise.all(
    comments.map(async (c) => ({
      ...c,
      author_avatar_url: await resolveAvatarUrl({ avatarUrl: (c as Record<string, unknown>).author_avatar_url as string | null ?? null }),
    }))
  );

  return Response.json({ data });
}
