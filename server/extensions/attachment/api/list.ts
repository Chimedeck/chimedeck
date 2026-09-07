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
import { serializeAttachment, type AttachmentRow, type ReferencedCard } from './serializeAttachment';

type CardRow = { id: string; list_id: string; title: string };
type ListRow = { id: string; board_id: string; title: string };
type BoardRow = { id: string; workspace_id: string; title: string };
type CardLabelRow = { card_id: string; label_id: string; name: string; color: string };

export async function handleListAttachments(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const resolvedCardId = await resolveCardId(cardId);
  if (!resolvedCardId) {
    return Response.json({ name: 'card-not-found', data: { message: 'Card not found' } }, { status: 404 });
  }

  const card = await db<CardRow>('cards').where({ id: resolvedCardId }).first();
  if (!card) {
    return Response.json({ name: 'card-not-found', data: { message: 'Card not found' } }, { status: 404 });
  }

  const list = await db<ListRow>('lists').where({ id: card.list_id }).first();
  const board = list ? await db<BoardRow>('boards').where({ id: list.board_id }).first() : null;
  if (!board) {
    return Response.json({ name: 'board-not-found', data: { message: 'Board not found' } }, { status: 404 });
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const attachments = await db<AttachmentRow>('attachments')
    .where({ card_id: resolvedCardId })
    .orderBy('created_at', 'desc');

  // Resolve referenced card data for internal card-link attachments.
  const referencedCardIds = attachments
    .map((a) => a.referenced_card_id)
    .filter((id): id is string => Boolean(id));

  const refCardMap: Record<string, ReferencedCard> = {};

  if (referencedCardIds.length > 0) {
    const refCards = await db<CardRow>('cards').whereIn('id', referencedCardIds);
    const refLists = await db<ListRow>('lists').whereIn('id', refCards.map((c) => c.list_id));
    const refBoards = await db<BoardRow>('boards').whereIn('id', refLists.map((l) => l.board_id));

    const cardLabelRows = await db<CardLabelRow>('card_labels')
      .join('labels', 'card_labels.label_id', 'labels.id')
      .whereIn('card_labels.card_id', referencedCardIds)
      .select<CardLabelRow[]>('card_labels.card_id', 'labels.id as label_id', 'labels.name', 'labels.color');

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
          .map((cl) => ({ id: cl.label_id, name: cl.name, color: cl.color })),
      };
    }
  }

  const data = attachments.map((attachment) => serializeAttachment(attachment, refCardMap));

  return Response.json({ data });
}
