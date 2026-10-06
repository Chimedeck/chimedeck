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
import { serializeAttachment } from './serializeAttachment';

export async function handleListAttachments(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const resolvedCardId = await resolveCardId(cardId);
  if (!resolvedCardId) {
    return Response.json(
      { name: 'card-not-found', data: { message: 'Card not found' } },
      { status: 404 }
    );
  }

  const card = await db('cards').where({ id: resolvedCardId }).first();
  if (!card) {
    return Response.json(
      { name: 'card-not-found', data: { message: 'Card not found' } },
      { status: 404 }
    );
  }

  const list = await db('lists').where({ id: card.list_id }).first();
  const board = list ? await db('boards').where({ id: list.board_id }).first() : null;
  if (!board) {
    return Response.json(
      { name: 'board-not-found', data: { message: 'Board not found' } },
      { status: 404 }
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const attachments = await db('attachments')
    .where({ card_id: resolvedCardId })
    .orderBy('position', 'asc')
    // [why] DESC fallback: unmigrated/new rows with equal or null position keep the
    // pre-migration newest-first order (migration 0130 preserves it — see brief).
    .orderBy('created_at', 'desc');

  // Resolve referenced card data for internal card-link attachments.
  const referencedCardIds = attachments
    .map((a) => a.referenced_card_id as string | null)
    .filter((id): id is string => Boolean(id));

  const refCardMap: Record<
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
    const refLists = await db('lists').whereIn(
      'id',
      refCards.map((c) => c.list_id)
    );
    const refBoards = await db('boards').whereIn(
      'id',
      refLists.map((l) => l.board_id)
    );

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
          .map((cl) => ({
            id: cl.label_id as string,
            name: cl.name as string,
            color: cl.color as string,
          })),
      };
    }
  }

  // Serialize through the shared allowlisted shape (same as reorder) so list
  // responses include `position` and never leak raw DB columns.
  return Response.json({ data: attachments.map((a) => serializeAttachment(a, refCardMap)) });
}
