// DELETE /api/v1/cards/:id/attachments/multipart/:uploadId
// Aborts an in-progress S3 multipart upload and removes the PENDING attachment row.
import { AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { s3Client, s3Config } from '../../common/config/s3';

export async function handleMultipartAbort(
  req: Request,
  cardId: string,
  uploadId: string,
): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  // The S3 key is required to abort — clients pass it as a query param
  const url = new URL(req.url);
  const s3Key = url.searchParams.get('key');
  if (!s3Key) {
    return Response.json(
      { name: 'bad-request', data: { message: 'key query parameter is required' } },
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
  const roleError = requireRole(scopedReq, 'MEMBER');
  if (roleError) return roleError;

  // Verify the S3 key belongs to a pending attachment on this card
  const attachment = await db('attachments').where({ card_id: cardId, s3_key: s3Key, status: 'PENDING' }).first();
  if (!attachment) {
    return Response.json(
      { name: 'attachment-not-found', data: { message: 'No pending attachment matches the provided key' } },
      { status: 404 },
    );
  }

  // Best-effort: abort the S3 multipart upload (may already be expired or completed)
  try {
    await s3Client.send(
      new AbortMultipartUploadCommand({
        Bucket: s3Config.bucket,
        Key: s3Key,
        UploadId: uploadId,
      }),
    );
  } catch (err: unknown) {
    // Log but proceed — the row must be cleaned up regardless
    console.warn('[multipart/abort] S3 abort warning (non-fatal):', err);
  }

  // Remove the PENDING attachment row so it does not accumulate as an orphan
  await db('attachments').where({ id: attachment.id }).delete();

  return new Response(null, { status: 204 });
}
