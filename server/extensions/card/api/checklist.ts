// Card checklist items sub-resource.
// POST   /api/v1/cards/:id/checklist          — add item; min role MEMBER
// PATCH  /api/v1/checklist-items/:id          — update title/checked/position; min role MEMBER
// DELETE /api/v1/checklist-items/:id          — delete item; min role MEMBER
import { randomUUID } from 'crypto';
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { between, HIGH_SENTINEL } from '../../list/mods/fractional';

async function resolveWorkspaceIdFromCard(cardId: string): Promise<string | null> {
  const card = await db('cards').where({ id: cardId }).first();
  if (!card) return null;
  const list = await db('lists').where({ id: card.list_id }).first();
  if (!list) return null;
  const board = await db('boards').where({ id: list.board_id }).first();
  return board?.workspace_id ?? null;
}

async function resolveWorkspaceIdFromItem(itemId: string): Promise<{ workspaceId: string | null; cardId: string | null }> {
  const item = await db('checklist_items').where({ id: itemId }).first();
  if (!item) return { workspaceId: null, cardId: null };
  const workspaceId = await resolveWorkspaceIdFromCard(item.card_id);
  return { workspaceId, cardId: item.card_id };
}

export async function handleCreateChecklistItem(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const card = await db('cards').where({ id: cardId }).first();
  if (!card) {
    return Response.json(
      { name: 'card-not-found', data: { message: 'Card not found' } },
      { status: 404 },
    );
  }

  const workspaceId = await resolveWorkspaceIdFromCard(cardId);
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

  let body: { title?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'bad-request', data: { message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
    return Response.json(
      { name: 'bad-request', data: { message: 'title is required' } },
      { status: 400 },
    );
  }

  // Append to end of checklist
  const lastItem = await db('checklist_items')
    .where({ card_id: cardId })
    .orderBy('position', 'desc')
    .first();

  const position = between(lastItem ? lastItem.position : '', HIGH_SENTINEL);

  const id = randomUUID();
  await db('checklist_items').insert({
    id,
    card_id: cardId,
    title: body.title.trim(),
    checked: false,
    position,
  });

  const item = await db('checklist_items').where({ id }).first();
  return Response.json({ data: item }, { status: 201 });
}

export async function handleUpdateChecklistItem(req: Request, itemId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const item = await db('checklist_items').where({ id: itemId }).first();
  if (!item) {
    return Response.json(
      { name: 'checklist-item-not-found', data: { message: 'Checklist item not found' } },
      { status: 404 },
    );
  }

  const { workspaceId } = await resolveWorkspaceIdFromItem(itemId);
  if (!workspaceId) {
    return Response.json(
      { name: 'checklist-item-not-found', data: { message: 'Checklist item context not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, workspaceId);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'MEMBER');
  if (roleError) return roleError;

  let body: { title?: string; checked?: boolean; position?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'bad-request', data: { message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const updates: { title?: string; checked?: boolean; position?: string } = {};

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim() === '') {
      return Response.json(
        { name: 'bad-request', data: { message: 'title must be a non-empty string' } },
        { status: 400 },
      );
    }
    updates.title = body.title.trim();
  }

  if (body.checked !== undefined) {
    if (typeof body.checked !== 'boolean') {
      return Response.json(
        { name: 'bad-request', data: { message: 'checked must be a boolean' } },
        { status: 400 },
      );
    }
    updates.checked = body.checked;
  }

  if (body.position !== undefined) {
    if (typeof body.position !== 'string' || body.position.trim() === '') {
      return Response.json(
        { name: 'bad-request', data: { message: 'position must be a non-empty string' } },
        { status: 400 },
      );
    }
    updates.position = body.position;
  }

  if (Object.keys(updates).length > 0) {
    await db('checklist_items').where({ id: itemId }).update(updates);
  }

  const updated = await db('checklist_items').where({ id: itemId }).first();
  return Response.json({ data: updated });
}

export async function handleDeleteChecklistItem(req: Request, itemId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const item = await db('checklist_items').where({ id: itemId }).first();
  if (!item) {
    return Response.json(
      { name: 'checklist-item-not-found', data: { message: 'Checklist item not found' } },
      { status: 404 },
    );
  }

  const { workspaceId } = await resolveWorkspaceIdFromItem(itemId);
  if (!workspaceId) {
    return Response.json(
      { name: 'checklist-item-not-found', data: { message: 'Checklist item context not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, workspaceId);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'MEMBER');
  if (roleError) return roleError;

  await db('checklist_items').where({ id: itemId }).delete();
  return new Response(null, { status: 204 });
}
