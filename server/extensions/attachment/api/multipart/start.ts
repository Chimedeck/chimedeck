// POST /api/v1/cards/:id/attachments/multipart/start
// Initiates an S3 multipart upload and creates a PENDING attachment row.
// Returns { uploadId, key, attachmentId } to the client.
import { randomUUID } from 'crypto';
import { CreateMultipartUploadCommand } from '@aws-sdk/client-s3';
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { s3Client, s3Config } from '../../common/config/s3';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '../../config/allowedTypes';

export async function handleMultipartStart(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

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

  if (!ALLOWED_MIME_TYPES.includes(body.mimeType)) {
    return Response.json({ name: 'mime-type-not-allowed', data: { mimeType: body.mimeType } }, { status: 400 });
  }

  if (body.sizeBytes > MAX_FILE_SIZE_BYTES) {
    return Response.json(
      { name: 'file-too-large', data: { sizeBytes: body.sizeBytes, maxBytes: MAX_FILE_SIZE_BYTES } },
      { status: 413 },
    );
  }

  const card = await db('cards').where({ id: cardId }).first();
  if (!card) {
    return Response.json({ name: 'card-not-found', data: { cardId } }, { status: 404 });
  }

  const list = await db('lists').where({ id: card.list_id }).first();
  const board = list ? await db('boards').where({ id: list.board_id }).first() : null;
  if (!board) {
    return Response.json({ name: 'board-not-found', data: {} }, { status: 404 });
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;
  const roleError = requireRole(scopedReq, 'MEMBER');
  if (roleError) return roleError;

  const actorId = (req as AuthenticatedRequest).currentUser!.id;
  const attachmentId = randomUUID();
  const s3Key = `attachments/${cardId}/${attachmentId}/${body.filename}`;

  const createCmd = new CreateMultipartUploadCommand({
    Bucket: s3Config.bucket,
    Key: s3Key,
    ContentType: body.mimeType,
  });

  let uploadId: string;
  try {
    const result = await s3Client.send(createCmd);
    if (!result.UploadId) throw new Error('S3 did not return an UploadId');
    uploadId = result.UploadId;
  } catch (err: unknown) {
    console.error('[multipart/start] S3 error:', err);
    return Response.json({ name: 's3-error', data: { message: 'Failed to initiate multipart upload' } }, { status: 502 });
  }

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

  return Response.json({ data: { attachmentId, uploadId, key: s3Key } }, { status: 201 });
}
