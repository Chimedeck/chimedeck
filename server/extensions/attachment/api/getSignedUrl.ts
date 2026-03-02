// GET /api/v1/attachments/:id/url
// Returns a pre-signed S3 GET URL (TTL 15 min); min role: VIEWER.
// Returns 202 / attachment-pending when status is PENDING.
// Returns 422 / virus-scan-rejected when status is REJECTED.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { presignGet } from '../mods/s3/presignGet';

export async function handleGetSignedUrl(req: Request, attachmentId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const attachment = await db('attachments').where({ id: attachmentId }).first();
  if (!attachment) {
    return Response.json(
      { name: 'attachment-not-found', data: { message: 'Attachment not found' } },
      { status: 404 },
    );
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
  const roleError = requireRole(scopedReq, 'VIEWER');
  if (roleError) return roleError;

  // URL attachments: return the raw URL directly
  if (attachment.type === 'URL') {
    return Response.json({ data: { url: attachment.url, expiresAt: null } });
  }

  // Gating by scan status
  if (attachment.status === 'PENDING') {
    return Response.json(
      { name: 'attachment-pending', data: { message: 'Attachment is still being scanned' } },
      { status: 202 },
    );
  }

  if (attachment.status === 'REJECTED') {
    return Response.json(
      { name: 'virus-scan-rejected', data: { message: 'Attachment was rejected by virus scan' } },
      { status: 422 },
    );
  }

  if (!attachment.s3_key) {
    return Response.json(
      { name: 'attachment-not-found', data: { message: 'No S3 key on attachment' } },
      { status: 404 },
    );
  }

  const { url, expiresAt } = await presignGet({ s3Key: attachment.s3_key });
  return Response.json({ data: { url, expiresAt } });
}
