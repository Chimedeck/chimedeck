// DELETE /api/v1/attachments/:id
// Deletes an attachment; removes S3 object for FILE type.
// Only the uploader or ADMIN+ may delete.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  hasRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { deleteObject } from '../mods/s3/deleteObject';
import { publisher } from '../../../mods/pubsub/publisher';
import { writeEvent } from '../../../mods/events/write';
import { writeActivity } from '../../activity/mods/write';

export async function handleDeleteAttachment(req: Request, attachmentId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const attachment = await db('attachments').where({ id: attachmentId }).first();
  if (!attachment) {
    return Response.json(
      { error: { code: 'attachment-not-found', message: 'Attachment not found' } },
      { status: 404 },
    );
  }

  const card = await db('cards').where({ id: attachment.card_id }).first();
  const list = card ? await db('lists').where({ id: card.list_id }).first() : null;
  const board = list ? await db('boards').where({ id: list.board_id }).first() : null;
  if (!board) {
    return Response.json({ error: { code: 'board-not-found', message: 'Board not found' } }, { status: 404 });
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const actorId = (req as AuthenticatedRequest).currentUser!.id;
  const isOwner = attachment.uploaded_by === actorId;
  const isAdmin = scopedReq.callerRole ? hasRole(scopedReq.callerRole, 'ADMIN') : false;

  if (!isOwner && !isAdmin) {
    return Response.json(
      { error: { code: 'attachment-not-owner', message: 'Only the uploader or an ADMIN may delete this attachment' } },
      { status: 403 },
    );
  }

  // Delete S3 objects for FILE attachments (best-effort; continue even on failure)
  if (attachment.type === 'FILE') {
    const keysToDelete = [attachment.s3_key, attachment.thumbnail_key].filter(
      (key): key is string => typeof key === 'string' && key.length > 0,
    );

    for (const s3Key of keysToDelete) {
      try {
        await deleteObject({ s3Key });
      } catch {
        // Log in production; do not block the delete
      }
    }
  }

  // Ensure card cover does not point to a removed attachment.
  await db('cards').where({ cover_attachment_id: attachmentId }).update({ cover_attachment_id: null });

  await db('attachments').where({ id: attachmentId }).delete();

  await writeEvent({
    type: 'attachment_deleted',
    boardId: board.id,
    entityId: attachment.card_id,
    actorId,
    payload: { attachmentId },
  });

  await writeActivity({
    entityType: 'card',
    entityId: attachment.card_id,
    boardId: board.id,
    action: 'attachment_removed',
    actorId,
    payload: { attachmentId, name: attachment.name, cardTitle: card?.title ?? '' },
  });

  publisher
    .publish(
      board.id,
      JSON.stringify({ type: 'attachment_deleted', entity_id: attachment.card_id, payload: { attachmentId } }),
    )
    .catch(() => {});

  return Response.json({ data: { id: attachmentId } });
}
