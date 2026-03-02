// Card labels sub-resource: attach and detach labels from cards.
// POST   /api/v1/cards/:id/labels           — attach; min role MEMBER
// DELETE /api/v1/cards/:id/labels/:labelId  — detach; min role MEMBER
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { requireBoardWritable, type BoardScopedRequest } from '../../board/middlewares/requireBoardWritable';
import { validateCardLabelLimit } from '../mods/labels/validate';

async function resolveWorkspaceId(cardId: string): Promise<string | null> {
  const card = await db('cards').where({ id: cardId }).first();
  if (!card) return null;
  const list = await db('lists').where({ id: card.list_id }).first();
  if (!list) return null;
  const board = await db('boards').where({ id: list.board_id }).first();
  return board?.workspace_id ?? null;
}

export async function handleAttachLabel(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const card = await db('cards').where({ id: cardId }).first();
  if (!card) {
    return Response.json(
      { name: 'card-not-found', data: { message: 'Card not found' } },
      { status: 404 },
    );
  }

  const boardReq = req as BoardScopedRequest;
  const list = await db('lists').where({ id: card.list_id }).first();
  if (list) {
    const writableError = await requireBoardWritable(boardReq, list.board_id);
    if (writableError) return writableError;
  }

  const workspaceId = await resolveWorkspaceId(cardId);
  if (!workspaceId) {
    return Response.json(
      { name: 'card-not-found', data: { message: 'Card context not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, workspaceId);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'MEMBER');
  if (roleError) return roleError;

  let body: { labelId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'bad-request', data: { message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (!body.labelId || typeof body.labelId !== 'string') {
    return Response.json(
      { name: 'bad-request', data: { message: 'labelId is required' } },
      { status: 400 },
    );
  }

  const label = await db('labels').where({ id: body.labelId }).first();
  if (!label) {
    return Response.json(
      { name: 'label-not-found', data: { message: 'Label not found' } },
      { status: 404 },
    );
  }

  if (label.workspace_id !== workspaceId) {
    return Response.json(
      { name: 'label-not-in-workspace', data: { message: 'Label does not belong to this workspace' } },
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
      { name: 'card-not-found', data: { message: 'Card not found' } },
      { status: 404 },
    );
  }

  const workspaceId = await resolveWorkspaceId(cardId);
  if (!workspaceId) {
    return Response.json(
      { name: 'card-not-found', data: { message: 'Card context not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, workspaceId);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'MEMBER');
  if (roleError) return roleError;

  await db('card_labels').where({ card_id: cardId, label_id: labelId }).delete();
  return new Response(null, { status: 204 });
}
