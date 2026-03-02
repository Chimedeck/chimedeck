// POST /api/v1/cards/:id/attachments/upload-url
// Creates a PENDING Attachment row and returns a pre-signed S3 PUT URL (TTL 5 min).
import { randomUUID } from 'crypto';
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { presignPut } from '../mods/s3/presignPut';
import { s3Config } from '../common/config/s3';

export async function handleRequestUploadUrl(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const card = await db('cards').where({ id: cardId }).first();
  if (!card) {
    return Response.json({ name: 'card-not-found', data: { message: 'Card not found' } }, { status: 404 });
  }

  const list = await db('lists').where({ id: card.list_id }).first();
  const board = list ? await db('boards').where({ id: list.board_id }).first() : null;
  if (!board) {
    return Response.json({ name: 'board-not-found', data: { message: 'Board not found' } }, { status: 404 });
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;
  const roleError = requireRole(scopedReq, 'MEMBER');
  if (roleError) return roleError;

  let body: { filename?: string; mimeType?: string; sizeBytes?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ name: 'bad-request', data: { message: 'Invalid JSON body' } }, { status: 400 });
  }

  if (!body.filename || !body.mimeType || typeof body.sizeBytes !== 'number') {
    return Response.json(
      { name: 'bad-request', data: { message: 'filename, mimeType, and sizeBytes are required' } },
      { status: 400 },
    );
  }

  const actorId = (req as AuthenticatedRequest).currentUser!.id;
  const attachmentId = randomUUID();
  const s3Key = `attachments/${cardId}/${attachmentId}/${body.filename}`;

  await db('attachments').insert({
    id: attachmentId,
    card_id: cardId,
    uploaded_by: actorId,
    name: body.filename,
    type: 'FILE',
    s3_key: s3Key,
    s3_bucket: s3Config.bucket,
    mime_type: body.mimeType,
    size_bytes: body.sizeBytes,
    status: 'PENDING',
    created_at: new Date().toISOString(),
  });

  const uploadUrl = await presignPut({ s3Key, mimeType: body.mimeType, sizeBytes: body.sizeBytes });

  return Response.json({ data: { attachmentId, uploadUrl, s3Key } }, { status: 201 });
}
