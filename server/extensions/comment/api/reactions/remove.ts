// DELETE /api/v1/comments/:commentId/reactions/:emoji — remove an emoji reaction (idempotent).
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { publisher } from '../../../../mods/pubsub/publisher';
import { writeActivity } from '../../../activity/mods/write';

export async function handleRemoveReaction(
  req: Request,
  commentId: string,
  emoji: string,
): Promise<Response> {
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

  const actorId = (req as AuthenticatedRequest).currentUser!.id;

  // Idempotent — delete returns 0 rows if the reaction didn't exist; still 200.
  const deleted = await db('comment_reactions')
    .where({ comment_id: commentId, user_id: actorId, emoji })
    .delete();

  if (deleted > 0) {
    await writeActivity({
      entityType: 'card',
      entityId: comment.card_id,
      boardId: board.id,
      action: 'comment_reaction_removed',
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
          type: 'comment_reaction_removed',
          payload: { card_id: comment.card_id, comment_id: commentId, emoji, user_id: actorId },
        }),
      )
      .catch(() => {});
  }

  return Response.json({ data: {} });
}
