// PATCH /api/v1/attachments/:id
// Updates the alias of an attachment.
// Requires authentication and board membership.
// Validates alias: non-empty string, max 255 characters.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';

const MAX_ALIAS_LENGTH = 255;

export async function handlePatchAttachment(req: Request, attachmentId: string): Promise<Response> {
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ name: 'invalid-request-body', data: { message: 'Request body must be valid JSON' } }, { status: 400 });
  }

  const { alias } = body as Record<string, unknown>;

  if (typeof alias !== 'string' || alias.trim() === '') {
    return Response.json(
      { name: 'alias-required', data: { message: 'alias must be a non-empty string' } },
      { status: 400 },
    );
  }

  if (alias.length > MAX_ALIAS_LENGTH) {
    return Response.json(
      { name: 'alias-too-long', data: { message: `alias must be at most ${MAX_ALIAS_LENGTH} characters` } },
      { status: 400 },
    );
  }

  const [updated] = await db('attachments')
    .where({ id: attachmentId })
    .update({ alias: alias.trim(), updated_at: new Date().toISOString() })
    .returning('*');

  const view_url =
    updated.type === 'URL'
      ? (updated.url ?? updated.external_url ?? null)
      : `/api/v1/attachments/${updated.id}/view`;

  const thumbnail_url = updated.thumbnail_key
    ? `/api/v1/attachments/${updated.id}/thumbnail`
    : null;

  return Response.json({
    data: {
      id: updated.id,
      card_id: updated.card_id,
      name: updated.name,
      alias: updated.alias ?? null,
      type: updated.type,
      content_type: updated.mime_type ?? null,
      size_bytes: updated.size_bytes ?? null,
      status: updated.status,
      view_url,
      thumbnail_url,
      external_url: updated.external_url ?? null,
      width: updated.width ?? null,
      height: updated.height ?? null,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    },
  });
}
