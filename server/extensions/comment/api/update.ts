// PATCH /api/v1/comments/:id — edit own comment (increments version); min role: MEMBER (own).
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { writeEvent } from '../../../mods/events/write';
import { writeActivity } from '../../activity/mods/write';
import { publisher } from '../../../mods/pubsub/publisher';
import { syncMentions } from '../../../common/mentions/sync';

export async function handleUpdateComment(req: Request, commentId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const comment = await db('comments').where({ id: commentId }).first();
  if (!comment) {
    return Response.json(
      { name: 'comment-not-found', data: { message: 'Comment not found' } },
      { status: 404 },
    );
  }

  if (comment.deleted) {
    return Response.json(
      { name: 'comment-deleted', data: { message: 'Cannot edit a deleted comment' } },
      { status: 409 },
    );
  }

  const actorId = (req as AuthenticatedRequest).currentUser!.id;

  if (comment.user_id !== actorId) {
    return Response.json(
      { name: 'comment-not-owner', data: { message: 'You can only edit your own comments' } },
      { status: 403 },
    );
  }

  const card = await db('cards').where({ id: comment.card_id }).first();
  const list = card ? await db('lists').where({ id: card.list_id }).first() : null;
  const board = list ? await db('boards').where({ id: list.board_id }).first() : null;
  if (!board) {
    return Response.json(
      { name: 'board-not-found', data: { message: 'Board not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  let body: { content?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'bad-request', data: { message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (!body.content || typeof body.content !== 'string' || body.content.trim() === '') {
    return Response.json(
      { name: 'bad-request', data: { message: 'content is required' } },
      { status: 400 },
    );
  }

  const newVersion = comment.version + 1;
  const trimmedContent = body.content.trim();

  await db.transaction(async (trx) => {
    await trx('comments').where({ id: commentId }).update({
      content: trimmedContent,
      version: newVersion,
      updated_at: new Date().toISOString(),
    });

    await syncMentions({
      trx,
      sourceType: 'comment',
      sourceId: commentId,
      text: trimmedContent,
      boardId: board.id,
      mentionedByUserId: actorId,
    });
  });

  const updated = await db('comments').where({ id: commentId }).first();

  await Promise.all([
    writeEvent({
      type: 'comment_edited',
      boardId: board.id,
      entityId: comment.card_id,
      actorId,
      payload: { commentId, version: newVersion },
    }),
    writeActivity({
      entityType: 'card',
      entityId: comment.card_id,
      boardId: board.id,
      action: 'comment_edited',
      actorId,
      payload: { commentId, version: newVersion, before: comment.content, after: trimmedContent },
    }),
  ]);

  // Broadcast so open card modals in other browser sessions reflect the edit in real time
  publisher.publish(
    board.id,
    JSON.stringify({ type: 'comment_updated', payload: { comment: updated } }),
  ).catch(() => {});

  return Response.json({ data: updated });
}
