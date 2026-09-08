// GET /api/v1/cards/:id/comments — list comments for a card; min role: MEMBER.
import { db } from '../../../common/db';
import { buildAvatarProxyUrl } from '../../../common/avatar/resolveAvatarUrl';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { resolveCardId } from '../../../common/ids/resolveEntityId';

interface ReactionRow {
  comment_id: string;
  emoji: string;
  user_id: string;
  reactor_name: string | null;
}

interface ReactionSummary {
  emoji: string;
  count: number;
  reactedByMe: boolean;
  reactors: Array<{ userId: string; name: string | null }>;
}

type ReactionAggregate = {
  count: number;
  meReacted: boolean;
  reactors: Array<{ userId: string; name: string | null }>;
};

interface CardRow {
  id: string;
  list_id: string;
}

interface ListRow {
  id: string;
  board_id: string;
}

interface BoardRow {
  id: string;
  workspace_id: string;
}

interface CommentListRow {
  id: string;
  card_id: string;
  user_id: string;
  content: string;
  version: number;
  deleted: boolean;
  parent_id: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  author_name: string | null;
  author_email: string | null;
  author_avatar_url: string | null;
  reply_count: number;
}

export async function handleListComments(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const resolvedCardId = await resolveCardId(cardId);
  if (!resolvedCardId) {
    return Response.json(
      { error: { code: 'card-not-found', message: 'Card not found' } },
      { status: 404 },
    );
  }

  const card = await db<CardRow>('cards').where({ id: resolvedCardId }).first();
  if (!card) {
    return Response.json(
      { error: { code: 'card-not-found', message: 'Card not found' } },
      { status: 404 },
    );
  }

  const list = await db<ListRow>('lists').where({ id: card.list_id }).first();
  const board = list ? await db<BoardRow>('boards').where({ id: list.board_id }).first() : null;
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

  const comments = (await db<CommentListRow>('comments')
    .leftJoin('users', 'comments.user_id', 'users.id')
    .where('comments.card_id', resolvedCardId)
    .whereNull('comments.parent_id')
    .orderBy('comments.created_at', 'asc')
    .select(
      'comments.id',
      'comments.card_id',
      'comments.user_id',
      'comments.content',
      'comments.version',
      'comments.deleted',
      'comments.parent_id',
      'comments.created_at',
      'comments.updated_at',
      db.raw("COALESCE(users.name, users.email) as author_name"),
      'users.email as author_email',
      'users.avatar_url as author_avatar_url',
      // [why] reply_count computed as a subquery to avoid N+1
      db.raw(
        '(SELECT COUNT(*) FROM comments AS replies WHERE replies.parent_id = comments.id AND replies.deleted = false)::int AS reply_count',
      ),
    )) as CommentListRow[];

  const callerUserId = (req as AuthenticatedRequest & { currentUser: { id: string } }).currentUser.id;
  const commentIds = comments.map((comment) => comment.id);

  // Single extra query — no N+1; group reactions in-process.
  const reactionRows: ReactionRow[] = commentIds.length
    ? ((await db<ReactionRow>('comment_reactions')
        .leftJoin('users as reactor', 'comment_reactions.user_id', 'reactor.id')
        .whereIn('comment_id', commentIds)
        .select(
          'comment_reactions.comment_id',
          'comment_reactions.emoji',
          'comment_reactions.user_id',
          db.raw("COALESCE(reactor.name, reactor.email) as reactor_name"),
        )) as ReactionRow[])
    : [];

  // Build Map<commentId, Map<emoji, { count, meReacted, reactors }>>
  const reactionMap = new Map<string, Map<string, ReactionAggregate>>();
  for (const row of reactionRows) {
    const emojiMap = reactionMap.get(row.comment_id) ?? new Map<string, ReactionAggregate>();
    const existing: ReactionAggregate = emojiMap.get(row.emoji) ?? { count: 0, meReacted: false, reactors: [] };
    existing.count += 1;
    existing.reactors.push({ userId: row.user_id, name: row.reactor_name ?? null });
    if (row.user_id === callerUserId) existing.meReacted = true;
    emojiMap.set(row.emoji, existing);
    reactionMap.set(row.comment_id, emojiMap);
  }

  const data = comments.map((comment) => {
    const emojiMap = reactionMap.get(comment.id);
    const reactions: ReactionSummary[] = emojiMap
      ? Array.from(emojiMap.entries())
          .map(([emoji, { count, meReacted, reactors }]) => ({ emoji, count, reactedByMe: meReacted, reactors }))
          .sort((a, b) => b.count - a.count)
      : [];

    return {
      ...comment,
      author_avatar_url: buildAvatarProxyUrl({
        userId: comment.user_id,
        avatarUrl: comment.author_avatar_url,
      }),
      reactions,
    };
  });

  return Response.json({ data });
}
