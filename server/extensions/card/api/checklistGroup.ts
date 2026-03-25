// Named checklist group CRUD.
// POST   /api/v1/cards/:id/checklists         — create a new checklist; min role MEMBER
// PATCH  /api/v1/checklists/:id               — rename a checklist; min role MEMBER
// DELETE /api/v1/checklists/:id               — delete checklist + all its items; min role MEMBER
// POST   /api/v1/checklists/:id/items         — add an item to a specific checklist; min role MEMBER
import { randomUUID } from 'node:crypto';
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireMemberOrBoardGuestMember,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { between, HIGH_SENTINEL } from '../../list/mods/fractional';
import { writeActivity } from '../../activity/mods/write';
import { publishCardActivityEvent } from '../../activity/events/publishCardActivityEvent';

interface CardContext { boardId: string; workspaceId: string; }

async function resolveContextFromCard(cardId: string): Promise<CardContext | null> {
  const card = await db('cards').where({ id: cardId }).first();
  if (!card) return null;
  const list = await db('lists').where({ id: card.list_id }).first();
  if (!list) return null;
  const board = await db('boards').where({ id: list.board_id }).first();
  if (!board) return null;
  return { boardId: board.id, workspaceId: board.workspace_id };
}

async function resolveContextFromChecklist(
  checklistId: string,
): Promise<{ context: CardContext | null; cardId: string | null }> {
  const checklist = await db('checklists').where({ id: checklistId }).first();
  if (!checklist) return { context: null, cardId: null };
  const context = await resolveContextFromCard(checklist.card_id);
  return { context, cardId: checklist.card_id };
}

async function checklistWithItems(checklistId: string) {
  const checklist = await db('checklists').where({ id: checklistId }).first();
  if (!checklist) return null;
  const items = await db('checklist_items')
    .where({ checklist_id: checklistId })
    .orderBy('position', 'asc');
  return { ...checklist, items };
}

// POST /api/v1/cards/:cardId/checklists
export async function handleCreateChecklist(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const card = await db('cards').where({ id: cardId }).first();
  if (!card) {
    return Response.json(
      { error: { name: 'card-not-found', data: { message: 'Card not found' } } },
      { status: 404 },
    );
  }

  const context = await resolveContextFromCard(cardId);
  if (!context) {
    return Response.json(
      { error: { name: 'card-not-found', data: { message: 'Card context not found' } } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, context.workspaceId);
  if (membershipError) return membershipError;

  const roleError = await requireMemberOrBoardGuestMember(scopedReq, context.boardId);
  if (roleError) return roleError;

  let body: { title?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // title is optional; default provided below
  }

  const title = (body.title as string | undefined)?.trim() || 'Checklist';

  const lastChecklist = await db('checklists')
    .where({ card_id: cardId })
    .orderBy('position', 'desc')
    .first();
  const position = between(lastChecklist ? lastChecklist.position : '', HIGH_SENTINEL);

  const id = randomUUID();
  await db('checklists').insert({
    id,
    card_id: cardId,
    title,
    position,
    created_at: new Date(),
    updated_at: new Date(),
  });

  const result = await checklistWithItems(id);

  const actorId = (req as AuthenticatedRequest).currentUser!.id;
  writeActivity({
    entityType: 'card',
    entityId: cardId,
    boardId: context.boardId,
    action: 'checklist_created',
    actorId,
    payload: { checklistTitle: title, cardTitle: card?.title ?? '' },
  }).then((activity) => {
    publishCardActivityEvent({ activity, boardId: context.boardId }).catch(() => {});
  }).catch(() => {});

  return Response.json({ data: result }, { status: 201 });
}

// PATCH /api/v1/checklists/:checklistId
export async function handleUpdateChecklist(req: Request, checklistId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const checklist = await db('checklists').where({ id: checklistId }).first();
  if (!checklist) {
    return Response.json(
      { error: { name: 'checklist-not-found', data: { message: 'Checklist not found' } } },
      { status: 404 },
    );
  }

  const { context } = await resolveContextFromChecklist(checklistId);
  if (!context) {
    return Response.json(
      { error: { name: 'checklist-not-found', data: { message: 'Checklist context not found' } } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, context.workspaceId);
  if (membershipError) return membershipError;

  const roleError = await requireMemberOrBoardGuestMember(scopedReq, context.boardId);
  if (roleError) return roleError;

  let body: { title?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { name: 'bad-request', data: { message: 'Invalid JSON body' } } },
      { status: 400 },
    );
  }

  if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
    return Response.json(
      { error: { name: 'bad-request', data: { message: 'title is required' } } },
      { status: 400 },
    );
  }

  await db('checklists').where({ id: checklistId }).update({
    title: body.title.trim(),
    updated_at: new Date(),
  });

  const result = await checklistWithItems(checklistId);
  return Response.json({ data: result });
}

// DELETE /api/v1/checklists/:checklistId
export async function handleDeleteChecklist(req: Request, checklistId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const checklist = await db('checklists').where({ id: checklistId }).first();
  if (!checklist) {
    return Response.json(
      { error: { name: 'checklist-not-found', data: { message: 'Checklist not found' } } },
      { status: 404 },
    );
  }

  const { context } = await resolveContextFromChecklist(checklistId);
  if (!context) {
    return Response.json(
      { error: { name: 'checklist-not-found', data: { message: 'Checklist context not found' } } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, context.workspaceId);
  if (membershipError) return membershipError;

  const roleError = await requireMemberOrBoardGuestMember(scopedReq, context.boardId);
  if (roleError) return roleError;

  // ON DELETE CASCADE removes checklist_items rows automatically
  await db('checklists').where({ id: checklistId }).delete();

  const actorId = (req as AuthenticatedRequest).currentUser!.id;
  const card = await db('cards').where({ id: checklist.card_id }).select('title').first();
  writeActivity({
    entityType: 'card',
    entityId: checklist.card_id,
    boardId: context.boardId,
    action: 'checklist_deleted',
    actorId,
    payload: { checklistTitle: checklist.title, cardTitle: card?.title ?? '' },
  }).then((activity) => {
    publishCardActivityEvent({ activity, boardId: context.boardId }).catch(() => {});
  }).catch(() => {});

  return new Response(null, { status: 204 });
}

// POST /api/v1/checklists/:checklistId/items
export async function handleCreateChecklistItemInGroup(
  req: Request,
  checklistId: string,
): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const checklist = await db('checklists').where({ id: checklistId }).first();
  if (!checklist) {
    return Response.json(
      { error: { name: 'checklist-not-found', data: { message: 'Checklist not found' } } },
      { status: 404 },
    );
  }

  const { context } = await resolveContextFromChecklist(checklistId);
  if (!context) {
    return Response.json(
      { error: { name: 'checklist-not-found', data: { message: 'Checklist context not found' } } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, context.workspaceId);
  if (membershipError) return membershipError;

  const roleError = await requireMemberOrBoardGuestMember(scopedReq, context.boardId);
  if (roleError) return roleError;

  let body: { title?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { name: 'bad-request', data: { message: 'Invalid JSON body' } } },
      { status: 400 },
    );
  }

  if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
    return Response.json(
      { error: { name: 'bad-request', data: { message: 'title is required' } } },
      { status: 400 },
    );
  }

  const lastItem = await db('checklist_items')
    .where({ checklist_id: checklistId })
    .orderBy('position', 'desc')
    .first();
  const position = between(lastItem ? lastItem.position : '', HIGH_SENTINEL);

  const id = randomUUID();
  await db('checklist_items').insert({
    id,
    card_id: checklist.card_id,
    checklist_id: checklistId,
    title: body.title.trim(),
    checked: false,
    position,
  });

  const item = await db('checklist_items').where({ id }).first();
  return Response.json({ data: item }, { status: 201 });
}
