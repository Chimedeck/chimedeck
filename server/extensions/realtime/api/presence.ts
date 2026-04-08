// server/extensions/realtime/api/presence.ts
// GET /api/v1/boards/:id/presence — returns list of currently active users on a board.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { cache } from '../../../mods/cache/index';
import { buildAvatarProxyUrl } from '../../../common/avatar/resolveAvatarUrl';

export async function handleGetPresence(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const board = await db('boards').where({ id: boardId }).first();
  if (!board) {
    return Response.json({ error: { code: 'board-not-found', message: 'Board not found' } }, { status: 404 });
  }

  const keys = await cache.keys(`presence:${boardId}:*`);
  const userIds = keys.map((k) => k.split(':')[2]).filter(Boolean) as string[];

  // Sprint 13: return full User objects including avatarUrl
  const users = userIds.length > 0
    ? await db('users').whereIn('id', userIds).select('id', 'email', 'name', 'avatar_url')
    : [];

  const data = users.map((user) => ({
    ...user,
    avatar_url: buildAvatarProxyUrl({ userId: user.id, avatarUrl: user.avatar_url ?? null }),
  }));

  return Response.json({ data });
}
