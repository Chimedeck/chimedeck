// Card labels sub-resource: attach and detach labels from cards.
// POST   /api/v1/cards/:id/labels           — attach; min role MEMBER
// DELETE /api/v1/cards/:id/labels/:labelId  — detach; min role MEMBER
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireMemberOrBoardGuestMember,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { requireBoardWritable, type BoardScopedRequest } from '../../board/middlewares/requireBoardWritable';
import { validateCardLabelLimit } from '../mods/labels/validate';

interface CardLabelContext { boardId: string; workspaceId: string; }

async function resolveCardLabelContext(cardId: string): Promise<CardLabelContext | null> {
  const card = await db('cards').where({ id: cardId }).first();
  if (!card) return null;
  const list = await db('lists').where({ id: card.list_id }).first();
  if (!list) return null;
  const board = await db('boards').where({ id: list.board_id }).first();
  if (!board) return null;
  return { boardId: board.id, workspaceId: board.workspace_id };
}

export async function handleAttachLabel(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const card = await db('cards').where({ id: cardId }).first();
  if (!card) {
    return Response.json(
      { error: { code: 'card-not-found', message: 'Card not found' } },
      { status: 404 },
    );
  }

  const boardReq = req as BoardScopedRequest;
  const list = await db('lists').where({ id: card.list_id }).first();
  if (list) {
    const writableError = await requireBoardWritable(boardReq, list.board_id);
    if (writableError) return writableError;
  }

  const labelContext = await resolveCardLabelContext(cardId);
  if (!labelContext) {
    return Response.json(
      { error: { code: 'card-not-found', message: 'Card context not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, labelContext.workspaceId);
  if (membershipError) return membershipError;

  const roleError = await requireMemberOrBoardGuestMember(scopedReq, labelContext.boardId);
  if (roleError) return roleError;

  let body: { labelId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (!body.labelId || typeof body.labelId !== 'string') {
    return Response.json(
      { error: { code: 'bad-request', message: 'labelId is required' } },
      { status: 400 },
    );
  }

  const label = await db('labels').where({ id: body.labelId }).first();
  if (!label) {
    return Response.json(
      { error: { code: 'label-not-found', message: 'Label not found' } },
      { status: 404 },
    );
  }

  if (label.board_id !== labelContext.boardId) {
    return Response.json(
      { error: { code: 'label-not-in-board', message: 'Label does not belong to this board' } },
      { status: 400 },
    );
  }

  // Idempotency: already assigned → return 200
  const existing = await db('card_labels').where({ card_id: cardId, label_id: body.labelId }).first();
  if (existing) {
    return Response.json({ data: { card_id: cardId, label_id: body.labelId } });
  }

  const limitError = await validateCardLabelLimit(cardId);
  if (limitError) return limitError;

  await db('card_labels').insert({ card_id: cardId, label_id: body.labelId });
  return Response.json({ data: { card_id: cardId, label_id: body.labelId } }, { status: 201 });
}

export async function handleDetachLabel(
  req: Request,
  cardId: string,
  labelId: string,
): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const card = await db('cards').where({ id: cardId }).first();
  if (!card) {
    return Response.json(
      { error: { code: 'card-not-found', message: 'Card not found' } },
      { status: 404 },
    );
  }

  const detachContext = await resolveCardLabelContext(cardId);
  if (!detachContext) {
    return Response.json(
      { error: { code: 'card-not-found', message: 'Card context not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, detachContext.workspaceId);
  if (membershipError) return membershipError;

  const roleError = await requireMemberOrBoardGuestMember(scopedReq, detachContext.boardId);
  if (roleError) return roleError;

  await db('card_labels').where({ card_id: cardId, label_id: labelId }).delete();
  return new Response(null, { status: 204 });
}
