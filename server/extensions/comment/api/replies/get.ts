// GET /api/v1/comments/:commentId/replies — fetch all direct replies to a comment.
import { db } from '../../../../common/db';
import { buildAvatarProxyUrl } from '../../../../common/avatar/resolveAvatarUrl';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';

export async function handleGetReplies(req: Request, commentId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const comment = await db('comments').where({ id: commentId }).first();
  if (!comment) {
    return Response.json(
      { error: { code: 'comment-not-found', message: 'Comment not found' } },
      { status: 404 },
    );
  }

  const card = await db('cards').where({ id: comment.card_id }).first();
  const list = card ? await db('lists').where({ id: card.list_id }).first() : null;
  const board = list ? await db('boards').where({ id: list.board_id }).first() : null;
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

  const replies = await db('comments')
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
    );

  const callerUserId = (req as AuthenticatedRequest).currentUser!.id;
  const replyIds = replies.map((r) => (r as Record<string, unknown>).id as string);

  const reactionRows = replyIds.length
    ? await db('comment_reactions')
        .whereIn('comment_id', replyIds)
        .select('comment_id', 'emoji', 'user_id')
    : [];

  const reactionMap = new Map<string, Map<string, { count: number; meReacted: boolean }>>();
  for (const row of reactionRows as { comment_id: string; emoji: string; user_id: string }[]) {
    if (!reactionMap.has(row.comment_id)) reactionMap.set(row.comment_id, new Map());
    const emojiMap = reactionMap.get(row.comment_id)!;
    const existing = emojiMap.get(row.emoji) ?? { count: 0, meReacted: false };
    existing.count += 1;
    if (row.user_id === callerUserId) existing.meReacted = true;
    emojiMap.set(row.emoji, existing);
  }

  const data = replies.map((r) => {
    const replyId = (r as Record<string, unknown>).id as string;
    const emojiMap = reactionMap.get(replyId);
    const reactions = emojiMap
      ? Array.from(emojiMap.entries())
          .map(([emoji, { count, meReacted }]) => ({ emoji, count, reactedByMe: meReacted }))
          .sort((a, b) => b.count - a.count)
      : [];

    return {
      ...r,
      author_avatar_url: buildAvatarProxyUrl({
        userId: (r as Record<string, unknown>).user_id as string,
        avatarUrl: (r as Record<string, unknown>).author_avatar_url as string | null ?? null,
      }),
      reactions,
    };
  });

  return Response.json({ data });
}
