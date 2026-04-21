// GET /api/v1/cards/:id/attachments
// Returns all attachments for a card.
// Raw S3 presigned URLs are NEVER returned; all file access is via the
// authenticated proxy endpoints (/api/v1/attachments/:id/view and /thumbnail).
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { resolveCardId } from '../../../common/ids/resolveEntityId';

export async function handleListAttachments(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const resolvedCardId = await resolveCardId(cardId);
  if (!resolvedCardId) {
    return Response.json({ name: 'card-not-found', data: { message: 'Card not found' } }, { status: 404 });
  }

  const card = await db('cards').where({ id: resolvedCardId }).first();
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

  const attachments = await db('attachments')
    .where({ card_id: resolvedCardId })
    .orderBy('created_at', 'desc');

  // Resolve referenced card data for internal card-link attachments.
  const referencedCardIds = attachments
    .map((a) => a.referenced_card_id as string | null)
    .filter((id): id is string => Boolean(id));

  let refCardMap: Record<
    string,
    {
      id: string;
      title: string;
      board_id: string | null;
      board_name: string | null;
      list_id: string | null;
      list_name: string | null;
      labels: Array<{ id: string; name: string; color: string }>;
    }
  > = {};

  if (referencedCardIds.length > 0) {
    const refCards = await db('cards').whereIn('id', referencedCardIds);
    const refLists = await db('lists').whereIn('id', refCards.map((c) => c.list_id));
    const refBoards = await db('boards').whereIn('id', refLists.map((l) => l.board_id));

    const cardLabelRows = await db('card_labels')
      .join('labels', 'card_labels.label_id', 'labels.id')
      .whereIn('card_labels.card_id', referencedCardIds)
      .select('card_labels.card_id', 'labels.id as label_id', 'labels.name', 'labels.color');

    const listMap = Object.fromEntries(refLists.map((l) => [l.id, l]));
    const boardMap = Object.fromEntries(refBoards.map((b) => [b.id, b]));

    for (const rc of refCards) {
      const refList = listMap[rc.list_id];
      const refBoard = refList ? boardMap[refList.board_id] : null;
      refCardMap[rc.id] = {
        id: rc.id,
        title: rc.title,
        board_id: refBoard?.id ?? null,
        board_name: refBoard?.title ?? null,
        list_id: refList?.id ?? null,
        list_name: refList?.title ?? null,
        labels: cardLabelRows
          .filter((cl) => cl.card_id === rc.id)
          .map((cl) => ({ id: cl.label_id as string, name: cl.name as string, color: cl.color as string })),
      };
    }
  }

  const data = attachments.map((attachment) => {
    // URL-type attachments expose their external URL directly (user-supplied, not S3).
    // FILE-type attachments use the authenticated proxy paths; never raw presigned URLs.
    const view_url =
      attachment.type === 'URL'
        ? (attachment.url ?? attachment.external_url ?? null)
        : `/api/v1/attachments/${attachment.id}/view`;

    const thumbnail_url = attachment.thumbnail_key
      ? `/api/v1/attachments/${attachment.id}/thumbnail`
      : null;

    return {
      id: attachment.id,
      card_id: attachment.card_id,
      name: attachment.name,
      alias: attachment.alias ?? null,
      type: attachment.type,
      content_type: attachment.mime_type ?? null,
      size_bytes: attachment.size_bytes ?? null,
      status: attachment.status,
      view_url,
      thumbnail_url,
      external_url: attachment.external_url ?? null,
      width: attachment.width ?? null,
      height: attachment.height ?? null,
      created_at: attachment.created_at,
      updated_at: attachment.updated_at,
      referenced_card_id: attachment.referenced_card_id ?? null,
      referenced_card: attachment.referenced_card_id
        ? (refCardMap[attachment.referenced_card_id as string] ?? null)
        : null,
    };
  });

  return Response.json({ data });
}
