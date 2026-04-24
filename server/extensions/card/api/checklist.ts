// Card checklist items sub-resource.
// POST   /api/v1/cards/:id/checklist          — add item; min role MEMBER
// PATCH  /api/v1/checklist-items/:id          — update title/checked/position; min role MEMBER
// DELETE /api/v1/checklist-items/:id          — delete item; min role MEMBER
import { randomUUID } from 'crypto';
import { db } from '../../../common/db';
import { dispatchEvent } from '../../../mods/events/dispatch';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireMemberOrBoardGuestMember,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { generateUniqueShortId } from '../../../common/ids/shortId';
import { between, HIGH_SENTINEL } from '../../list/mods/fractional';
import { writeActivity } from '../../activity/mods/write';
import { publishCardActivityEvent } from '../../activity/events/publishCardActivityEvent';
import { mapActivityToNotification } from '../../activity/mods/mapActivityToNotification';
import { resolveCoverImageUrl } from '../../../common/cards/cover';

interface CardContext { boardId: string; workspaceId: string; }

interface ChecklistItemPatchBody {
  title?: string;
  checked?: boolean;
  position?: string;
  assigned_member_id?: string | null;
  due_date?: string | null;
}

async function resolveContextFromCard(cardId: string): Promise<CardContext | null> {
  const card = await db('cards').where({ id: cardId }).first();
  if (!card) return null;
  const list = await db('lists').where({ id: card.list_id }).first();
  if (!list) return null;
  const board = await db('boards').where({ id: list.board_id }).first();
  if (!board) return null;
  return { boardId: board.id, workspaceId: board.workspace_id };
}

async function resolveContextFromItem(itemId: string): Promise<{ context: CardContext | null; cardId: string | null }> {
  const item = await db('checklist_items').where({ id: itemId }).first();
  if (!item) return { context: null, cardId: null };
  const context = await resolveContextFromCard(item.card_id);
  return { context, cardId: item.card_id };
}

export async function handleCreateChecklistItem(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const card = await db('cards').where({ id: cardId }).first();
  if (!card) {
    return Response.json(
      { error: { code: 'card-not-found', message: 'Card not found' } },
      { status: 404 },
    );
  }

  const context = await resolveContextFromCard(cardId);
  if (!context) {
    return Response.json(
      { error: { code: 'card-not-found', message: 'Card context not found' } },
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
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
    return Response.json(
      { error: { code: 'bad-request', message: 'title is required' } },
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
      { error: { code: 'checklist-item-not-found', message: 'Checklist item not found' } },
      { status: 404 },
    );
  }

  const { context: updateContext, cardId: updateCardId } = await resolveContextFromItem(itemId);
  if (!updateContext) {
    return Response.json(
      { error: { code: 'checklist-item-not-found', message: 'Checklist item context not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, updateContext.workspaceId);
  if (membershipError) return membershipError;

  const roleError = await requireMemberOrBoardGuestMember(scopedReq, updateContext.boardId);
  if (roleError) return roleError;

  let body: ChecklistItemPatchBody;
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const updates: {
    title?: string;
    checked?: boolean;
    position?: string;
    assigned_member_id?: string | null;
    due_date?: string | null;
  } = {};

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim() === '') {
      return Response.json(
        { error: { code: 'bad-request', message: 'title must be a non-empty string' } },
        { status: 400 },
      );
    }
    updates.title = body.title.trim();
  }

  if (body.checked !== undefined) {
    if (typeof body.checked !== 'boolean') {
      return Response.json(
        { error: { code: 'bad-request', message: 'checked must be a boolean' } },
        { status: 400 },
      );
    }
    updates.checked = body.checked;
  }

  if (body.position !== undefined) {
    if (typeof body.position !== 'string' || body.position.trim() === '') {
      return Response.json(
        { error: { code: 'bad-request', message: 'position must be a non-empty string' } },
        { status: 400 },
      );
    }
    updates.position = body.position;
  }

  if (body.assigned_member_id !== undefined) {
    if (body.assigned_member_id !== null && typeof body.assigned_member_id !== 'string') {
      return Response.json(
        { error: { code: 'bad-request', message: 'assigned_member_id must be a string or null' } },
        { status: 400 },
      );
    }

    if (typeof body.assigned_member_id === 'string') {
      const boardMember = await db('board_members')
        .where({ board_id: updateContext.boardId, user_id: body.assigned_member_id })
        .first();
      const boardGuest = await db('board_guest_access')
        .where({ board_id: updateContext.boardId, user_id: body.assigned_member_id })
        .first();

      if (!boardMember && !boardGuest) {
        return Response.json(
          { error: { code: 'bad-request', message: 'assigned_member_id must be a member or guest of this board' } },
          { status: 400 },
        );
      }
    }

    updates.assigned_member_id = body.assigned_member_id;
  }

  if (body.due_date !== undefined) {
    if (body.due_date !== null && typeof body.due_date !== 'string') {
      return Response.json(
        { error: { code: 'bad-request', message: 'due_date must be an ISO date string or null' } },
        { status: 400 },
      );
    }
    if (typeof body.due_date === 'string') {
      const parsed = new Date(body.due_date);
      if (Number.isNaN(parsed.getTime())) {
        return Response.json(
          { error: { code: 'bad-request', message: 'due_date must be a valid ISO date string or null' } },
          { status: 400 },
        );
      }
      updates.due_date = parsed.toISOString();
    } else {
      updates.due_date = null;
    }
  }

  if (Object.keys(updates).length > 0) {
    await db('checklist_items').where({ id: itemId }).update(updates);
  }

  const updated = await db('checklist_items').where({ id: itemId }).first();

  const checkedChanged = updates.checked !== undefined && item.checked !== updated?.checked;
  const assigneeChanged =
    updates.assigned_member_id !== undefined
    && (item.assigned_member_id ?? null) !== (updated?.assigned_member_id ?? null);
  const dueDateChanged =
    updates.due_date !== undefined
    && (item.due_date ?? null) !== (updated?.due_date ?? null);

  if ((checkedChanged || assigneeChanged || dueDateChanged) && updateCardId && updateContext) {
    const actorId = (req as AuthenticatedRequest).currentUser!.id;
    const [card, checklist] = await Promise.all([
      db('cards').where({ id: updateCardId }).select('title').first(),
      updated?.checklist_id
        ? db('checklists').where({ id: updated.checklist_id }).select('title').first()
        : Promise.resolve(null),
    ]);

    const basePayload = {
      itemTitle: updated?.title ?? item.title,
      checklistTitle: checklist?.title ?? '',
      cardTitle: card?.title ?? '',
      cardId: updateCardId,
      boardId: updateContext.boardId,
    };

    const emitActivity = async (action: string, payload: Record<string, unknown>) => {
      const activity = await writeActivity({
        entityType: 'card',
        entityId: updateCardId,
        boardId: updateContext.boardId,
        action,
        actorId,
        payload,
      });
      publishCardActivityEvent({ activity, boardId: updateContext.boardId }).catch(() => {});
      mapActivityToNotification({ activity, boardId: updateContext.boardId }).catch(() => {});
    };

    if (checkedChanged) {
      await emitActivity(
        updated?.checked ? 'checklist_item_checked' : 'checklist_item_unchecked',
        basePayload,
      );
    }

    if (assigneeChanged) {
      const previousAssigneeId = item.assigned_member_id ?? null;
      const nextAssigneeId = updated?.assigned_member_id ?? null;
      let assigneeName = '';
      if (nextAssigneeId) {
        const assignee = await db('users')
          .where({ id: nextAssigneeId })
          .select('name', 'email')
          .first();
        assigneeName = assignee?.name ?? assignee?.email ?? nextAssigneeId;
      }

      const assignmentEventType = nextAssigneeId
        ? 'checklist_item_assigned'
        : 'checklist_item_unassigned';

      await dispatchEvent({
        type: assignmentEventType,
        boardId: updateContext.boardId,
        entityId: updateCardId,
        actorId,
        payload: {
          ...basePayload,
          checklistItemId: itemId,
          previousUserId: previousAssigneeId,
          userId: nextAssigneeId,
          assigneeName,
        },
      });

      await emitActivity(
        assignmentEventType,
        {
          ...basePayload,
          checklistItemId: itemId,
          previousUserId: previousAssigneeId,
          userId: nextAssigneeId,
          assigneeName,
        },
      );
    }

    if (dueDateChanged) {
      const dueDateAssigneeId = updated?.assigned_member_id ?? item.assigned_member_id ?? null;
      const dueDateEventType = updated?.due_date
        ? 'checklist_item_due_date_set'
        : 'checklist_item_due_date_removed';

      await dispatchEvent({
        type: dueDateEventType,
        boardId: updateContext.boardId,
        entityId: updateCardId,
        actorId,
        payload: {
          ...basePayload,
          checklistItemId: itemId,
          userId: dueDateAssigneeId,
          dueDate: updated?.due_date ?? null,
          previousDueDate: item.due_date ?? null,
        },
      });

      await emitActivity('checklist_item_due_date_updated', {
        ...basePayload,
        checklistItemId: itemId,
        userId: dueDateAssigneeId,
        dueDate: updated?.due_date ?? null,
        previousDueDate: item.due_date ?? null,
      });
    }
  }

  return Response.json({ data: updated });
}

export async function handleDeleteChecklistItem(req: Request, itemId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const item = await db('checklist_items').where({ id: itemId }).first();
  if (!item) {
    return Response.json(
      { error: { code: 'checklist-item-not-found', message: 'Checklist item not found' } },
      { status: 404 },
    );
  }

  const { context: deleteContext } = await resolveContextFromItem(itemId);
  if (!deleteContext) {
    return Response.json(
      { error: { code: 'checklist-item-not-found', message: 'Checklist item context not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, deleteContext.workspaceId);
  if (membershipError) return membershipError;

  const roleError = await requireMemberOrBoardGuestMember(scopedReq, deleteContext.boardId);
  if (roleError) return roleError;

  await db('checklist_items').where({ id: itemId }).delete();
  return new Response(null, { status: 204 });
}

// POST /api/v1/checklist-items/:id/convert — convert checklist item into a card
export async function handleConvertChecklistItemToCard(req: Request, itemId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const item = await db('checklist_items').where({ id: itemId }).first();
  if (!item) {
    return Response.json(
      { error: { code: 'checklist-item-not-found', message: 'Checklist item not found' } },
      { status: 404 },
    );
  }

  const { context } = await resolveContextFromItem(itemId);
  if (!context) {
    return Response.json(
      { error: { code: 'checklist-item-not-found', message: 'Checklist item context not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, context.workspaceId);
  if (membershipError) return membershipError;

  const roleError = await requireMemberOrBoardGuestMember(scopedReq, context.boardId);
  if (roleError) return roleError;

  if (item.linked_card_id) {
    const existingCard = await db('cards').where({ id: item.linked_card_id }).first();
    if (existingCard) {
      const existingWithCover = await resolveCoverImageUrl(
        existingCard as { id: string; cover_attachment_id?: string | null },
      );
      return Response.json(
        {
          error: { code: 'checklist-item-already-converted', message: 'Checklist item has already been converted' },
          data: { item, card: existingWithCover },
        },
        { status: 409 },
      );
    }
  }

  const parentCard = await db('cards').where({ id: item.card_id }).first();
  if (!parentCard) {
    return Response.json(
      { error: { code: 'card-not-found', message: 'Parent card not found' } },
      { status: 404 },
    );
  }

  const lastCard = await db('cards')
    .where({ list_id: parentCard.list_id, archived: false })
    .orderBy('position', 'desc')
    .first();
  const position = between(lastCard ? lastCard.position : '', HIGH_SENTINEL);

  const newCardId = randomUUID();
  const shortId = await generateUniqueShortId('cards');
  await db('cards').insert({
    id: newCardId,
    short_id: shortId,
    list_id: parentCard.list_id,
    title: item.title,
    description: null,
    position,
    archived: false,
  });

  await db('checklist_items').where({ id: itemId }).delete();

  const createdCard = await db('cards').where({ id: newCardId }).first();
  const cardWithCover = await resolveCoverImageUrl(
    createdCard as { id: string; cover_attachment_id?: string | null },
  );

  const actorId = (req as AuthenticatedRequest).currentUser?.id ?? 'system';
  await dispatchEvent({
    type: 'card.created',
    boardId: context.boardId,
    entityId: newCardId,
    actorId,
    payload: {
      card: cardWithCover,
      listId: parentCard.list_id,
      source: 'checklist-item-conversion',
      checklistItemId: itemId,
    },
  });

  return Response.json(
    {
      data: {
        card: cardWithCover,
        removedItemId: itemId,
        removedChecklistId: item.checklist_id,
      },
    },
    { status: 201 },
  );
}
