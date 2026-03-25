// GET /api/v1/attachments/:id/thumbnail
// Secure proxy endpoint for attachment thumbnails. Same auth/authorisation logic as
// view.ts but uses the thumbnail_key instead of the main s3_key.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { presignGetUrl } from '../common/presign';

const PROXY_TTL_SECONDS = 60;

export async function handleThumbnailAttachment(req: Request, attachmentId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const attachment = await db('attachments').where({ id: attachmentId }).first();
  if (!attachment) {
    return Response.json({ name: 'attachment-not-found', data: { message: 'Attachment not found' } }, { status: 404 });
  }

  const card = await db('cards').where({ id: attachment.card_id }).first();
  const list = card ? await db('lists').where({ id: card.list_id }).first() : null;
  const board = list ? await db('boards').where({ id: list.board_id }).first() : null;
  if (!board) {
    return Response.json({ name: 'board-not-found', data: { message: 'Board not found' } }, { status: 404 });
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  if (!attachment.thumbnail_key) {
    return Response.json({ name: 'thumbnail-not-found', data: { message: 'No thumbnail for this attachment' } }, { status: 404 });
  }

  if (attachment.status === 'PENDING') {
    return Response.json({ name: 'attachment-pending', data: { message: 'Attachment is still being processed' } }, { status: 202 });
  }

  if (attachment.status === 'REJECTED') {
    return Response.json({ name: 'attachment-rejected', data: { message: 'Attachment was rejected by virus scan' } }, { status: 422 });
  }

  const { url } = await presignGetUrl({ s3Key: attachment.thumbnail_key, ttlSeconds: PROXY_TTL_SECONDS });

  return Response.redirect(url, 302);
}
