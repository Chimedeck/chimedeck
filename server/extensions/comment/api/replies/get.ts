// GET /api/v1/comments/:commentId/replies — fetch all direct replies to a comment.
import { db } from '../../../../common/db';
import { buildAvatarProxyUrl } from '../../../../common/avatar/resolveAvatarUrl';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';

// Card columns from 0006_card.ts.
interface CardRow {
  id: string;
  list_id: string;
}

// List columns from 0005_list.ts.
interface ListRow {
  id: string;
  board_id: string;
}

// Board columns from 0004_board.ts.
interface BoardRow {
  id: string;
  workspace_id: string;
}

// Comment columns from 0010_comments_activity.ts + 0104_comment_reactions.ts + 0105_comment_replies.ts,
// joined against users (author_name/author_email/author_avatar_url) as in list.ts.
interface ReplyRow {
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
}

// comment_reactions columns from 0104_comment_reactions.ts.
interface ReactionRow {
  comment_id: string;
  emoji: string;
  user_id: string;
}

export async function handleGetReplies(req: Request, commentId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const comment = await db<{ id: string; card_id: string }>('comments').where({ id: commentId }).first();
  if (!comment) {
    return Response.json(
      { error: { code: 'comment-not-found', message: 'Comment not found' } },
      { status: 404 },
    );
  }

  const card = await db<CardRow>('cards').where({ id: comment.card_id }).first();
  const list = card ? await db<ListRow>('lists').where({ id: card.list_id }).first() : null;
  const board = list ? await db<BoardRow>('boards').where({ id: list.board_id }).first() : null;
  if (!board) {
    return Response.json(
      { error: { code: 'board-not-found', message: 'Board not found' } },
      { status: 404 },
    );
  }

  const membershipError = await requireWorkspaceMembership(
    req as WorkspaceScopedRequest,
    board.workspace_id,
  );
  if (membershipError) return membershipError;

  const replies = (await db<ReplyRow>('comments')
    .leftJoin('users', 'comments.user_id', 'users.id')
    .where('comments.parent_id', commentId)
    .where('comments.deleted', false)
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
    )) as ReplyRow[];

  const callerUserId = (req as AuthenticatedRequest & { currentUser: { id: string } }).currentUser.id;
  const replyIds = replies.map((r) => r.id);

  const reactionRows: ReactionRow[] = replyIds.length
    ? ((await db<ReactionRow>('comment_reactions')
        .whereIn('comment_id', replyIds)
        .select('comment_id', 'emoji', 'user_id')) as ReactionRow[])
    : [];

  const reactionMap = new Map<string, Map<string, { count: number; meReacted: boolean }>>();
  for (const row of reactionRows) {
    const emojiMap = reactionMap.get(row.comment_id) ?? new Map<string, { count: number; meReacted: boolean }>();
    const existing = emojiMap.get(row.emoji) ?? { count: 0, meReacted: false };
    existing.count += 1;
    if (row.user_id === callerUserId) existing.meReacted = true;
    emojiMap.set(row.emoji, existing);
    reactionMap.set(row.comment_id, emojiMap);
  }

  const data = replies.map((r) => {
    const emojiMap = reactionMap.get(r.id);
    const reactions = emojiMap
      ? Array.from(emojiMap.entries())
          .map(([emoji, { count, meReacted }]) => ({ emoji, count, reactedByMe: meReacted }))
          .sort((a, b) => b.count - a.count)
      : [];

    return {
      ...r,
      author_avatar_url: buildAvatarProxyUrl({
        userId: r.user_id,
        avatarUrl: r.author_avatar_url,
      }),
      reactions,
    };
  });

  return Response.json({ data });
}
