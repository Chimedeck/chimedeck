// DELETE /api/v1/comments/:id — soft-delete comment; owner or ADMIN only.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  hasRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { writeEvent } from '../../../mods/events/write';
import { writeActivity } from '../../activity/mods/write';
import { publisher } from '../../../mods/pubsub/publisher';

export async function handleDeleteComment(req: Request, commentId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const comment = await db('comments').where({ id: commentId }).first();
  if (!comment) {
    return Response.json(
      { error: { code: 'comment-not-found', message: 'Comment not found' } },
      { status: 404 },
    );
  }

  if (comment.deleted) {
    return Response.json(
      { error: { code: 'comment-deleted', message: 'Comment is already deleted' } },
      { status: 409 },
    );
  }

  const actorId = (req as AuthenticatedRequest).currentUser!.id;

  const card = await db('cards').where({ id: comment.card_id }).first();
  const list = card ? await db('lists').where({ id: card.list_id }).first() : null;
  const board = list ? await db('boards').where({ id: list.board_id }).first() : null;
  if (!board) {
    return Response.json(
      { error: { code: 'board-not-found', message: 'Board not found' } },
      { status: 404 },
    );
  }

  if (board.state === 'ARCHIVED') {
    return Response.json(
      { error: { code: 'board-is-archived', message: 'This board is archived and cannot be modified.' } },
      { status: 403 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  // Only owner or ADMIN+ can soft-delete
  const isOwner = comment.user_id === actorId;
  const isAdmin = scopedReq.callerRole ? hasRole(scopedReq.callerRole, 'ADMIN') : false;
  if (!isOwner && !isAdmin) {
    return Response.json(
      { error: { code: 'comment-not-owner', message: 'You can only delete your own comments (or be an ADMIN)' } },
      { status: 403 },
    );
  }

  await db('comments').where({ id: commentId }).update({
    deleted: true,
    content: '[deleted]',
    updated_at: new Date().toISOString(),
  });

  const deleted = await db('comments').where({ id: commentId }).first();

  await Promise.all([
    writeEvent({
      type: 'comment_deleted',
      boardId: board.id,
      entityId: comment.card_id,
      actorId,
      payload: { commentId },
    }),
    writeActivity({
      entityType: 'card',
      entityId: comment.card_id,
      boardId: board.id,
      action: 'comment_deleted',
      actorId,
      payload: { commentId },
    }),
  ]);

  // Broadcast so open card modals in other browser sessions remove the comment in real time
  publisher.publish(
    board.id,
    JSON.stringify({ type: 'comment_deleted', payload: { commentId, cardId: comment.card_id } }),
  ).catch(() => {});

  return Response.json({ data: deleted });
}
