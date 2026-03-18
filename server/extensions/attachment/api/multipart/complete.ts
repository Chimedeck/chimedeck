// POST /api/v1/cards/:id/attachments/multipart/complete
// Completes a multipart S3 upload, marks the attachment READY, enqueues virus scan.
import { CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireMemberOrBoardGuestMember,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { s3Client, s3Config } from '../../common/config/s3';
import { enqueueScan } from '../../mods/virusScan/enqueue';
import { publisher } from '../../../../mods/pubsub/publisher';
import { writeEvent } from '../../../../mods/events/write';

interface CompletedPart {
  partNumber: number;
  eTag: string;
}

export async function handleMultipartComplete(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  let body: { uploadId?: string; key?: string; parts?: CompletedPart[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ name: 'bad-request', data: { message: 'Invalid JSON body' } }, { status: 400 });
  }

  if (!body.uploadId || !body.key || !Array.isArray(body.parts) || body.parts.length === 0) {
    return Response.json(
      { name: 'bad-request', data: { message: 'uploadId, key, and parts[] are required' } },
      { status: 400 },
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
  const roleError = await requireMemberOrBoardGuestMember(scopedReq, board.id);
  if (roleError) return roleError;

  // Verify the S3 key belongs to a pending attachment on this card
  const attachment = await db('attachments').where({ card_id: cardId, s3_key: body.key, status: 'PENDING' }).first();
  if (!attachment) {
    return Response.json(
      { name: 'attachment-not-found', data: { message: 'No pending attachment matches the provided key' } },
      { status: 404 },
    );
  }

  const completeParts = body.parts
    .sort((a, b) => a.partNumber - b.partNumber)
    .map((p) => ({ PartNumber: p.partNumber, ETag: p.eTag }));

  try {
    await s3Client.send(
      new CompleteMultipartUploadCommand({
        Bucket: s3Config.bucket,
        Key: body.key,
        UploadId: body.uploadId,
        MultipartUpload: { Parts: completeParts },
      }),
    );
  } catch (err: unknown) {
    console.error('[multipart/complete] S3 error:', err);
    return Response.json(
      { name: 'multipart-complete-failed', data: { message: 'Failed to complete multipart upload' } },
      { status: 502 },
    );
  }

  const actorId = (req as AuthenticatedRequest).currentUser!.id;

  // Enqueue virus scan — fires even when VIRUS_SCAN_ENABLED=false (no-op internally)
  await enqueueScan({ attachmentId: attachment.id });

  await writeEvent({
    type: 'attachment_added',
    boardId: board.id,
    entityId: cardId,
    actorId,
    payload: { attachmentId: attachment.id, cardId },
  });

  publisher
    .publish(
      board.id,
      JSON.stringify({ type: 'attachment_added', entity_id: cardId, payload: { attachmentId: attachment.id } }),
    )
    .catch(() => {});

  const updated = await db('attachments').where({ id: attachment.id }).first();
  return Response.json({ data: updated }, { status: 200 });
}
