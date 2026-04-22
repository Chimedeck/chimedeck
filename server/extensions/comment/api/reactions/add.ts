// POST /api/v1/comments/:commentId/reactions — add an emoji reaction (idempotent).
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { publisher } from '../../../../mods/pubsub/publisher';
import { writeActivity } from '../../../activity/mods/write';
import { createReactionNotification } from '../../../notifications/mods/createReactionNotification';

export async function handleAddReaction(req: Request, commentId: string): Promise<Response> {
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

  let body: { emoji?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (
    !body.emoji ||
    typeof body.emoji !== 'string' ||
    body.emoji.trim() === '' ||
    body.emoji.trim().length > 32
  ) {
    return Response.json(
      { error: { code: 'reaction-emoji-invalid', message: 'emoji must be a non-empty string of ≤ 32 characters' } },
      { status: 400 },
    );
  }

  const emoji = body.emoji.trim();
  const actorId = (req as AuthenticatedRequest).currentUser!.id;

  const reactionKey = { comment_id: commentId, user_id: actorId, emoji };

  // Duplicate add requests are idempotent and must not emit activity/notifications twice.
  const existingReaction = await db('comment_reactions').where(reactionKey).first();
  if (existingReaction) {
    return Response.json({ data: { comment_id: commentId, emoji, user_id: actorId } });
  }

  try {
    await db('comment_reactions').insert(reactionKey);
  } catch (error) {
    // Handle race between concurrent add requests safely (idempotent success, no duplicate emit).
    const dbError = error as { code?: string };
    if (
      dbError?.code === '23505' ||
      dbError?.code === 'SQLITE_CONSTRAINT' ||
      dbError?.code === 'SQLITE_CONSTRAINT_UNIQUE'
    ) {
      return Response.json({ data: { comment_id: commentId, emoji, user_id: actorId } });
    }
    throw error;
  }

  // Fetch actor name for WS payload so clients can show reactor names in tooltips immediately.
  const actor = await db('users')
    .where({ id: actorId })
    .select(db.raw("COALESCE(name, email) as display_name"))
    .first();

  await writeActivity({
    entityType: 'card',
    entityId: comment.card_id,
    boardId: board.id,
    action: 'comment_reaction_added',
    actorId,
    payload: {
      commentId,
      cardId: comment.card_id,
      cardTitle: card.title,
      emoji,
    },
  });

  publisher
    .publish(
      board.id,
      JSON.stringify({
        type: 'comment_reaction_added',
        payload: {
          card_id: comment.card_id,
          comment_id: commentId,
          emoji,
          user_id: actorId,
          actor_name: actor?.display_name ?? null,
        },
      }),
    )
    .catch(() => {});

  // Fire-and-forget notification to the comment author (respects their opt-out preferences)
  createReactionNotification({
    commentId,
    actorId,
    emoji,
    cardId: comment.card_id,
    boardId: board.id,
  }).catch(() => {});

  return Response.json({ data: { comment_id: commentId, emoji, user_id: actorId } });
}
