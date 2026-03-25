// GET /api/v1/attachments/:id/view
// Secure proxy endpoint: authenticates the caller, verifies board membership,
// then 302-redirects to a fresh short-lived (60 s) presigned S3 URL.
// Never exposes the presigned URL unless the caller is authenticated and authorised.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { presignGetUrl } from '../common/presign';

// Very short TTL: the presigned URL is single-use in practice because the browser
// immediately follows the redirect, and the token expires after 60 seconds.
const PROXY_TTL_SECONDS = 60;

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

  const { url } = await presignGetUrl({ s3Key: attachment.s3_key, ttlSeconds: PROXY_TTL_SECONDS });

  // 302 redirect to the fresh short-lived presigned URL — client downloads directly
  // from S3 while the token is invisible in the API response body.
  return Response.redirect(url, 302);
}
