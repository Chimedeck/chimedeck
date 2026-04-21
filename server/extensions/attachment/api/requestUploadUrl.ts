// POST /api/v1/cards/:id/attachments/upload-url
// Validates MIME type and file size, creates a PENDING Attachment row, and returns
// a pre-signed S3 PUT URL (TTL 5 min).
import { randomUUID } from 'crypto';
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireMemberOrBoardGuestMember,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { presignPut } from '../mods/s3/presignPut';
import { s3Config } from '../common/config/s3';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '../config/allowedTypes';
import { resolveCardId } from '../../../common/ids/resolveEntityId';
import { generateUniqueShortId } from '../../../common/ids/shortId';

export async function handleRequestUploadUrl(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const resolvedCardId = await resolveCardId(cardId);
  if (!resolvedCardId) {
    return Response.json({ error: { code: 'card-not-found', message: 'Card not found' } }, { status: 404 });
  }

  // Parse and validate body early — before any DB lookup so validation errors
  // are returned cheaply without hitting the database.
  let body: { filename?: string; mimeType?: string; sizeBytes?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: { code: 'bad-request', message: 'Invalid JSON body' } }, { status: 400 });
  }

  if (!body.filename || !body.mimeType || typeof body.sizeBytes !== 'number') {
    return Response.json(
      { error: { code: 'bad-request', message: 'filename, mimeType, and sizeBytes are required' } },
      { status: 400 },
    );
  }

  // Validate MIME type against the allowlist
  if (!ALLOWED_MIME_TYPES.includes(body.mimeType)) {
    return Response.json({ name: 'mime-type-not-allowed', data: { mimeType: body.mimeType } }, { status: 400 });
  }

  // Enforce file size cap
  if (body.sizeBytes > MAX_FILE_SIZE_BYTES) {
    return Response.json(
      { name: 'file-too-large', data: { sizeBytes: body.sizeBytes, maxBytes: MAX_FILE_SIZE_BYTES } },
      { status: 413 },
    );
  }

  const card = await db('cards').where({ id: resolvedCardId }).first();
  if (!card) {
    return Response.json({ error: { code: 'card-not-found', message: 'Card not found' } }, { status: 404 });
  }

  const list = await db('lists').where({ id: card.list_id }).first();
  const board = list ? await db('boards').where({ id: list.board_id }).first() : null;
  if (!board) {
    return Response.json({ error: { code: 'board-not-found', message: 'Board not found' } }, { status: 404 });
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;
  const roleError = await requireMemberOrBoardGuestMember(scopedReq, board.id);
  if (roleError) return roleError;

  const actorId = (req as AuthenticatedRequest).currentUser!.id;
  const attachmentId = randomUUID();
  const shortId = await generateUniqueShortId('attachments');
  const s3Key = `attachments/${resolvedCardId}/${attachmentId}/${body.filename}`;

  await db('attachments').insert({
    id: attachmentId,
    short_id: shortId,
    card_id: resolvedCardId,
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
