// POST /api/v1/cards/:cardId/attachments/reorder — batch position update; min role: MEMBER.
// Validates that order.length === attachment count for the card, then assigns
// fresh lexicographic positions to every attachment in the supplied order.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import {
  requireBoardWritable,
  type BoardScopedRequest,
} from '../../board/middlewares/requireBoardWritable';
import { resolveCardId } from '../../../common/ids/resolveEntityId';
import { generatePositions } from '../../list/mods/fractional';

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

  const roleError = requireRole(scopedReq, 'MEMBER');
  if (roleError) return roleError;

  let body: { order?: string[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.order)) {
    return Response.json(
      { error: { code: 'bad-request', message: 'order must be an array of attachment IDs' } },
      { status: 400 }
    );
  }

  // Fetch all attachments for this card
  const attachments = await db('attachments').where({ card_id: resolvedCardId });

  // Validate count matches
  if (body.order.length !== attachments.length) {
    return Response.json(
      {
        name: 'reorder-count-mismatch',
        data: {
          message: `order has ${body.order.length} items but card has ${attachments.length} attachments`,
        },
      },
      { status: 400 }
    );
  }

  // Validate all IDs belong to this card
  const attachmentIds = new Set(attachments.map((a) => a.id as string));
  for (const id of body.order) {
    if (!attachmentIds.has(id)) {
      return Response.json(
        {
          error: {
            code: 'attachment-card-mismatch',
            message: `Attachment ${id} does not belong to this card`,
          },
        },
        { status: 400 }
      );
    }
  }

  // Assign fresh well-spaced positions
  const positions = generatePositions(body.order.length);

  await db.transaction(async (trx) => {
    for (let i = 0; i < body.order!.length; i++) {
      await trx('attachments').where({ id: body.order![i] }).update({ position: positions[i] });
    }
  });

  // Return updated attachments in the new order
  const updatedAttachments = await db('attachments')
    .where({ card_id: resolvedCardId })
    .orderBy('position', 'asc');

  return Response.json({ data: updatedAttachments });
}
