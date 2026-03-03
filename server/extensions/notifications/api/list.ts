// GET /api/v1/notifications — list notifications for the authenticated user.
// Supports ?unread=true and cursor pagination (?limit=20&cursor=<created_at>).
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';

export async function handleListNotifications(req: Request): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const userId = (req as AuthenticatedRequest).currentUser!.id;
  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get('unread') === 'true';
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 100);
  const cursor = url.searchParams.get('cursor') ?? null;

  let query = db('notifications')
    .where('notifications.user_id', userId)
    .leftJoin('users as actor', 'notifications.actor_id', 'actor.id')
    .leftJoin('cards', 'notifications.card_id', 'cards.id')
    .leftJoin('boards', 'notifications.board_id', 'boards.id')
    .select(
      'notifications.id',
      'notifications.type',
      'notifications.source_type',
      'notifications.source_id',
      'notifications.card_id',
      'cards.title as card_title',
      'notifications.board_id',
      'boards.title as board_title',
      'notifications.read',
      'notifications.created_at',
      db.raw("actor.id as actor_id"),
      db.raw("actor.nickname as actor_nickname"),
      db.raw("COALESCE(actor.name, actor.email) as actor_name"),
      db.raw("actor.avatar_url as actor_avatar_url"),
    )
    .orderBy('notifications.created_at', 'desc')
    .limit(limit + 1);

  if (unreadOnly) {
    query = query.where('notifications.read', false);
  }

  if (cursor) {
    query = query.where('notifications.created_at', '<', cursor);
  }

  const rows = await query;
  const hasMore = rows.length > limit;
  const data = rows.slice(0, limit).map((row) => ({
    id: row.id,
    type: row.type,
    source_type: row.source_type,
    source_id: row.source_id,
    card_id: row.card_id,
    card_title: row.card_title ?? null,
    board_id: row.board_id,
    board_title: row.board_title ?? null,
    actor: {
      id: row.actor_id,
      nickname: row.actor_nickname ?? null,
      name: row.actor_name ?? null,
      avatar_url: row.actor_avatar_url ?? null,
    },
    read: row.read,
    created_at: row.created_at,
  }));

  const lastItem = data[data.length - 1];
  const nextCursor = hasMore && lastItem ? lastItem.created_at : null;

  return Response.json({
    data,
    metadata: { cursor: nextCursor, hasMore },
  });
}
