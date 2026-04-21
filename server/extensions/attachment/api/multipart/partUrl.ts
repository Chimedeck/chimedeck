// POST /api/v1/cards/:id/attachments/multipart/part-url
// Returns a pre-signed S3 URL for uploading a single part of a multipart upload.
import { UploadPartCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireMemberOrBoardGuestMember,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { s3Client, s3Config } from '../../common/config/s3';
import { resolveCardId } from '../../../../common/ids/resolveEntityId';

const PART_URL_TTL_SECONDS = 5 * 60; // 5 minutes — enough for a single-part upload

export async function handleMultipartPartUrl(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const resolvedCardId = await resolveCardId(cardId);
  if (!resolvedCardId) {
    return Response.json({ name: 'card-not-found', data: { cardId } }, { status: 404 });
  }

  let body: { uploadId?: string; key?: string; partNumber?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ name: 'bad-request', data: { message: 'Invalid JSON body' } }, { status: 400 });
  }

  if (!body.uploadId || !body.key || typeof body.partNumber !== 'number') {
    return Response.json(
      { name: 'bad-request', data: { message: 'uploadId, key, and partNumber are required' } },
      { status: 400 },
    );
  }

  if (body.partNumber < 1 || body.partNumber > 10000) {
    return Response.json(
      { name: 'invalid-part-number', data: { message: 'partNumber must be between 1 and 10000' } },
      { status: 422 },
    );
  }

  const card = await db('cards').where({ id: resolvedCardId }).first();
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
  const roleError = await requireMemberOrBoardGuestMember(scopedReq, board.id);
  if (roleError) return roleError;

  // Verify the S3 key belongs to an attachment on this card (prevents key injection)
  const attachment = await db('attachments')
    .where({ card_id: resolvedCardId, s3_key: body.key, status: 'PENDING' })
    .first();
  if (!attachment) {
    return Response.json(
      { name: 'attachment-not-found', data: { message: 'No pending attachment matches the provided key' } },
      { status: 404 },
    );
  }

  const command = new UploadPartCommand({
    Bucket: s3Config.bucket,
    Key: body.key,
    UploadId: body.uploadId,
    PartNumber: body.partNumber,
  });

  let partUrl: string;
  try {
    partUrl = await getSignedUrl(s3Client, command, { expiresIn: PART_URL_TTL_SECONDS });
  } catch (err: unknown) {
    console.error('[multipart/part-url] S3 error:', err);
    return Response.json({ name: 's3-error', data: { message: 'Failed to generate part URL' } }, { status: 502 });
  }

  // [why] Client expects `url`; keep `partUrl` for backward compatibility.
  return Response.json({ data: { url: partUrl, partUrl, partNumber: body.partNumber } }, { status: 200 });
}
