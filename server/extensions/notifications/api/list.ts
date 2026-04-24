// GET /api/v1/notifications — list notifications for the authenticated user.
// Supports ?unread=true and cursor pagination (?limit=20&cursor=<created_at>).
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { buildAvatarProxyUrl } from '../../../common/avatar/resolveAvatarUrl';

interface ReactionRow {
  comment_id: string;
  emoji: string;
  user_id: string;
  reactor_name: string | null;
}

interface NotificationReactionSummary {
  emoji: string;
  count: number;
  reactedByMe: boolean;
  reactors: Array<{ userId: string; name: string | null }>;
}

export async function handleListNotifications(req: Request): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const userId = (req as AuthenticatedRequest).currentUser!.id;
  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get('unread') === 'true';
  const limit = Math.min(Number.parseInt(url.searchParams.get('limit') ?? '20', 10), 100);
  const cursor = url.searchParams.get('cursor') ?? null;

  // Optional type filter — keep in sync with notification type constraints/preferences.
  const VALID_TYPES = new Set([
    'mention',
    'card_created',
    'card_moved',
    'card_commented',
    'comment_reaction',
    'card_member_assigned',
    'card_member_unassigned',
    'checklist_item_assigned',
    'checklist_item_unassigned',
    'checklist_item_due_date_updated',
    'card_updated',
    'card_deleted',
    'card_archived',
  ]);
  const typeParam = url.searchParams.get('type') ?? null;
  const typeFilter = typeParam && VALID_TYPES.has(typeParam) ? typeParam : null;

  let query = db('notifications')
    .where('notifications.user_id', userId)
    .leftJoin('users as actor', 'notifications.actor_id', 'actor.id')
    .leftJoin('cards', 'notifications.card_id', 'cards.id')
    .leftJoin('boards', 'notifications.board_id', 'boards.id')
    .leftJoin('comments as source_comment', 'notifications.source_id', 'source_comment.id')
    // Join to get the destination list name for card_moved notifications
    .leftJoin('lists', 'cards.list_id', 'lists.id')
    .select(
      'notifications.id',
      'notifications.type',
      'notifications.source_type',
      'notifications.source_id',
      'notifications.card_id',
      'notifications.emoji',
      'cards.title as card_title',
      'cards.description as card_description_content',
      'notifications.board_id',
      'boards.title as board_title',
      'lists.title as list_title',
      'source_comment.content as comment_content',
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

  if (typeFilter) {
    query = query.where('notifications.type', typeFilter);
  }

  if (cursor) {
    query = query.where('notifications.created_at', '<', cursor);
  }

  const rows = await query;
  const hasMore = rows.length > limit;
  const visibleRows = rows.slice(0, limit);

  // Aggregate reactions once for all visible comment-backed notifications.
  const sourceIds = Array.from(
    new Set(
      visibleRows
        .filter((row) => row.source_type === 'comment')
        .map((row) => row.source_id)
        .filter((sourceId): sourceId is string => typeof sourceId === 'string' && sourceId.length > 0),
    ),
  );

  const reactionRows = sourceIds.length
    ? await db('comment_reactions')
        .leftJoin('users as reactor', 'comment_reactions.user_id', 'reactor.id')
        .whereIn('comment_reactions.comment_id', sourceIds)
        .select(
          'comment_reactions.comment_id',
          'comment_reactions.emoji',
          'comment_reactions.user_id',
          db.raw('COALESCE(reactor.name, reactor.email) as reactor_name'),
        )
    : [];

  const reactionByComment = new Map<string, Map<string, {
    count: number;
    meReacted: boolean;
    reactors: Array<{ userId: string; name: string | null }>;
  }>>();

  for (const row of reactionRows as ReactionRow[]) {
    if (!reactionByComment.has(row.comment_id)) {
      reactionByComment.set(row.comment_id, new Map());
    }

    const emojiMap = reactionByComment.get(row.comment_id);
    if (!emojiMap) continue;
    const existing = emojiMap.get(row.emoji) ?? { count: 0, meReacted: false, reactors: [] };
    existing.count += 1;
    existing.reactors.push({ userId: row.user_id, name: row.reactor_name ?? null });
    if (row.user_id === userId) {
      existing.meReacted = true;
    }
    emojiMap.set(row.emoji, existing);
  }

  const commentReactionMap = new Map<string, NotificationReactionSummary[]>();
  for (const [commentId, emojiMap] of reactionByComment.entries()) {
    commentReactionMap.set(
      commentId,
      Array.from(emojiMap.entries())
        .map(([emoji, value]) => ({
          emoji,
          count: value.count,
          reactedByMe: value.meReacted,
          reactors: value.reactors,
        }))
        .sort((a, b) => b.count - a.count),
    );
  }

  const data = await Promise.all(
    visibleRows.map(async (row) => {
      const actorAvatarUrl = row.actor_avatar_url ?? null;
      const commentContentFromCommentSource =
        row.source_type === 'comment' && typeof row.comment_content === 'string'
          ? row.comment_content
          : null;
      const commentContentFromDescriptionMention =
        row.type === 'mention' && row.source_type === 'card_description' && typeof row.card_description_content === 'string'
          ? row.card_description_content
          : null;
      const commentContent = commentContentFromCommentSource ?? commentContentFromDescriptionMention;

      return {
        id: row.id,
        type: row.type,
        source_type: row.source_type,
        source_id: row.source_id,
        card_id: row.card_id,
        emoji: row.emoji ?? null,
        card_title: row.card_title ?? null,
        board_id: row.board_id,
        board_title: row.board_title ?? null,
        list_title: row.list_title ?? null,
        comment_content: commentContent,
        comment_reactions: row.source_type === 'comment'
          ? (commentReactionMap.get(row.source_id) ?? [])
          : [],
        actor: {
          id: row.actor_id,
          nickname: row.actor_nickname ?? null,
          name: row.actor_name ?? null,
          avatar_url: row.actor_id
            ? buildAvatarProxyUrl({ userId: row.actor_id, avatarUrl: actorAvatarUrl })
            : null,
        },
        read: row.read,
        created_at: row.created_at,
      };
    }),
  );

  const lastItem = data.at(-1);
  const nextCursor = hasMore && lastItem ? lastItem.created_at : null;

  return Response.json({
    data,
    metadata: { cursor: nextCursor, hasMore },
  });
}
