// GET /api/v1/cards/:id/attachments
// Returns all attachments for a card with pre-signed download URLs (TTL 1 h).
// Image attachments with a generated thumbnail also include a thumbnailUrl.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { presignGetUrl } from '../common/presign';

export async function handleListAttachments(req: Request, cardId: string): Promise<Response> {
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
  const roleError = requireRole(scopedReq, 'VIEWER');
  if (roleError) return roleError;

  const attachments = await db('attachments')
    .where({ card_id: cardId })
    .orderBy('created_at', 'desc');

  const data = await Promise.all(
    attachments.map(async (attachment) => {
      let url: string | null = null;
      let thumbnailUrl: string | null = null;

      if (attachment.type === 'URL') {
        url = attachment.url ?? null;
      } else if (attachment.s3_key && attachment.status === 'READY') {
        const { url: signedUrl } = await presignGetUrl({ s3Key: attachment.s3_key });
        url = signedUrl;
      }

      // Only include thumbnailUrl when a thumbnail has been generated
      if (attachment.thumbnail_key) {
        const { url: thumbUrl } = await presignGetUrl({ s3Key: attachment.thumbnail_key });
        thumbnailUrl = thumbUrl;
      }

      return {
        id: attachment.id,
        name: attachment.name,
        type: attachment.type,
        mimeType: attachment.mime_type ?? null,
        sizeBytes: attachment.size_bytes ?? null,
        status: attachment.status,
        url,
        thumbnailUrl,
        width: attachment.width ?? null,
        height: attachment.height ?? null,
        createdAt: attachment.created_at,
      };
    }),
  );

  return Response.json({ data });
}
