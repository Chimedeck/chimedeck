// POST /api/v1/cards/:cardId/attachments/reorder — batch position update; min role:
// workspace MEMBER, or board guest with MEMBER sub-type (shared attachment policy).
// Validates that order.length === attachment count for the card, then assigns
// fresh lexicographic positions to every attachment in the supplied order.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireMemberOrBoardGuestMember,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import {
  requireBoardWritable,
  type BoardScopedRequest,
} from '../../board/middlewares/requireBoardWritable';
import { resolveCardId } from '../../../common/ids/resolveEntityId';
import { generatePositions } from '../../list/mods/fractional';
import { serializeAttachment, type ReferencedCard } from './serializeAttachment';

export type ReorderValidation =
  | { ok: true }
  | { ok: false; name: string; message: string };

// [why] Pure validation of the requested order against the card's attachment set —
// kept free of db access so the duplicate/mismatch rules can be unit-tested directly.
export function validateReorderOrder(
  order: unknown,
  attachments: Array<{ id: string }>
): ReorderValidation {
  if (!Array.isArray(order)) {
    return { ok: false, name: 'bad-request', message: 'order must be an array of attachment IDs' };
  }
  if (order.length !== attachments.length) {
    return {
      ok: false,
      name: 'reorder-count-mismatch',
      message: `order has ${order.length} items but card has ${attachments.length} attachments`,
    };
  }
  // [why] A duplicate like [a, a] passes count + membership checks yet updates `a`
  // twice and leaves the omitted attachment with its old position.
  const seen = new Set<string>();
  for (const id of order) {
    if (seen.has(id)) {
      return {
        ok: false,
        name: 'reorder-duplicate-attachment',
        message: `Attachment ${id} appears more than once in order`,
      };
    }
    seen.add(id);
  }
  const attachmentIds = new Set(attachments.map((a) => a.id));
  for (const id of order) {
    if (!attachmentIds.has(id)) {
      return {
        ok: false,
        name: 'attachment-card-mismatch',
        message: `Attachment ${id} does not belong to this card`,
      };
    }
  }
  return { ok: true };
}

export async function handleReorderAttachments(req: Request, cardId: string): Promise<Response> {
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

  const boardReq = req as BoardScopedRequest;
  const writableError = await requireBoardWritable(boardReq, board.id);
  if (writableError) return writableError;

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  // [why] Shared attachment-authorization helper (requestUploadUrl/confirmUpload/addUrl
  // use the same): workspace MEMBER/ADMIN/OWNER pass, and board guests whose
  // board-level sub-type is MEMBER may reorder the attachments they can already
  // upload/add — otherwise a guest MEMBER could add attachments but get 403 on
  // reorder for no policy reason.
  const roleError = await requireMemberOrBoardGuestMember(scopedReq, board.id);
  if (roleError) return roleError;

  let body: { order?: string[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'bad-request', data: { message: 'Invalid JSON body' } },
      { status: 400 }
    );
  }

  // Fetch all attachments for this card, then validate the requested order
  // (count, duplicates, membership) via the shared pure helper.
  const attachments = await db('attachments').where({ card_id: resolvedCardId });

  const validation = validateReorderOrder(body.order, attachments as Array<{ id: string }>);
  if (!validation.ok) {
    return Response.json(
      { name: validation.name, data: { message: validation.message } },
      { status: 400 }
    );
  }

  // Assign fresh well-spaced positions. `body.order` is optional-typed at the JSON
  // boundary; after validateReorderOrder succeeded it is a full permutation of the
  // card's attachments, so bind it to a non-optional local.
  const order: string[] = body.order as string[];
  const positions = generatePositions(order.length);

  // [why lock + re-validate inside] The pre-transaction read validated a snapshot.
  // An upload/delete committed between validation and the updates would let a
  // partial permutation through (the old updates were scoped by attachment id
  // alone), and two concurrent reorders could lock rows in different
  // client-supplied orders and deadlock. Inside the transaction: re-read the
  // card's attachment rows FOR UPDATE, re-validate the permutation against that
  // locked snapshot, and update in DETERMINISTIC id order (never the
  // client-supplied order) with card_id in every update predicate — concurrent
  // reorders of the same card serialize instead of deadlocking, and an
  // attachment that disappeared re-validated to a count mismatch (400).
  // db.transaction resolves with the callback's return value, so an in-transaction
  // validation failure surfaces as a non-null rejection payload.
  const txFailure = await db.transaction(
    async (trx): Promise<{ name: string; message: string } | null> => {
      const locked = (await trx('attachments')
        .where({ card_id: resolvedCardId })
        .forUpdate()
        .orderBy('id', 'asc')) as Array<{ id: string }>;

      // Lock + re-validate against the card's FULL attachment set (not just the
      // ids in `order`): an attachment uploaded between the pre-transaction read
      // and this query must be seen here, or the permutation would be validated
      // against a set that no longer matches what the update loop leaves behind
      // (a concurrent upload would end up position-less). validateReorderOrder
      // then rejects with count-mismatch — the caller re-lists and retries.
      const validationInside = validateReorderOrder(order, locked);
      if (!validationInside.ok) {
        return { name: validationInside.name, message: validationInside.message };
      }

      const positionById = new Map(order.map((id, idx) => [id, positions[idx] as string]));
      for (const id of [...order].sort()) {
        await trx('attachments')
          .where({ id, card_id: resolvedCardId })
          .update({ position: positionById.get(id) as string });
      }
      return null;
    }
  );
  if (txFailure) {
    return Response.json(
      { name: txFailure.name, data: { message: txFailure.message } },
      { status: 400 }
    );
  }

  // Return updated attachments in the new order — serialized through the same
  // allowlisted shape as the list API (never raw DB rows, which would expose
  // s3_key/s3_bucket/uploaded_by).
  const updatedAttachments = await db('attachments')
    .where({ card_id: resolvedCardId })
    .orderBy('position', 'asc');

  // Resolve referenced card data for internal card-link attachments
  // (same shape as the list API's refCardMap).
  const referencedCardIds = updatedAttachments
    .map((a) => a.referenced_card_id as string | null)
    .filter((id): id is string => Boolean(id));

  const refCardMap: Record<string, ReferencedCard> = {};

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

  return Response.json({ data: updatedAttachments.map((a) => serializeAttachment(a, refCardMap)) });
}
