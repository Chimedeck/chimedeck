// GET /api/v1/attachments/:id/view
// Secure proxy endpoint: authenticates the caller, verifies board membership,
// then streams the object from S3 through the server to the browser.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { proxyS3Object } from '../common/proxyS3Object';

export async function handleViewAttachment(req: Request, attachmentId: string): Promise<Response> {
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

  // URL-type attachments: redirect directly to the external URL
  if (attachment.type === 'URL') {
    const target = attachment.url ?? attachment.external_url;
    if (!target) {
      return Response.json({ name: 'attachment-url-missing', data: { message: 'No URL on attachment' } }, { status: 404 });
    }
    return Response.redirect(target, 302);
  }

  if (attachment.status === 'PENDING') {
    return Response.json({ name: 'attachment-pending', data: { message: 'Attachment is still being processed' } }, { status: 202 });
  }

  if (attachment.status === 'REJECTED') {
    return Response.json({ name: 'attachment-rejected', data: { message: 'Attachment was rejected by virus scan' } }, { status: 422 });
  }

  if (!attachment.s3_key) {
    return Response.json({ name: 'attachment-key-missing', data: { message: 'No S3 key on attachment' } }, { status: 404 });
  }

  return proxyS3Object({
    s3Key: attachment.s3_key,
    fallbackContentType: attachment.mime_type,
    fallbackFilename: attachment.alias ?? attachment.name,
  });
}
