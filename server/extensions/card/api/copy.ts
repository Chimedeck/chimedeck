// POST /api/v1/cards/:id/copy — copy card to any list with optional checklists & members; min role: MEMBER.
import { randomUUID } from 'node:crypto';
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { dispatchEvent } from '../../../mods/events/dispatch';
import {
  requireWorkspaceMembership,
  requireMemberOrBoardGuestMember,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { requireCardWritable, type CardScopedRequest } from '../middlewares/requireCardWritable';
import { between, LOW_SENTINEL, HIGH_SENTINEL } from '../../list/mods/fractional';
import { resolveCoverImageUrl } from '../../../common/cards/cover';

type CardRow = {
  cover_color?: string | null;
  cover_size?: string | null;
  [key: string]: unknown;
};

function computePosition(
  targetCards: Array<{ position: string }>,
  positionIdx: number,
): string {
  if (targetCards.length === 0) return between(LOW_SENTINEL, HIGH_SENTINEL);
  if (positionIdx <= 0) return between(LOW_SENTINEL, targetCards[0]!.position);
  if (positionIdx >= targetCards.length) return between(targetCards.at(-1)!.position, HIGH_SENTINEL);
  return between(targetCards[positionIdx - 1]!.position, targetCards[positionIdx]!.position);
}

async function copyChecklists(sourceCardId: string, newCardId: string): Promise<void> {
  const checklists = await db('checklists')
    .where({ card_id: sourceCardId })
    .orderBy('position', 'asc');
  for (const checklist of checklists) {
    const newChecklistId = randomUUID();
    await db('checklists').insert({
      id: newChecklistId,
      card_id: newCardId,
      title: checklist.title,
      position: checklist.position,
    });
    const items = await db('checklist_items')
      .where({ checklist_id: checklist.id })
      .orderBy('position', 'asc');
    if (items.length > 0) {
      await db('checklist_items').insert(
        items.map((item: { title: string; position: string; assigned_member_id?: string | null; due_date?: string | null }) => ({
          id: randomUUID(),
          card_id: newCardId,
          checklist_id: newChecklistId,
          title: item.title,
          checked: false,
          position: item.position,
          assigned_member_id: item.assigned_member_id ?? null,
          due_date: item.due_date ?? null,
          linked_card_id: null,
        })),
      );
    }
  }
}

export async function handleCopyCard(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const cardReq = req as CardScopedRequest;
  const writableError = await requireCardWritable(cardReq, cardId);
  if (writableError) return writableError;

  const card = cardReq.card!;
  const board = cardReq.board!;

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const roleError = await requireMemberOrBoardGuestMember(scopedReq, board.id);
  if (roleError) return roleError;

  let body: {
    targetListId: string;
    position?: number;
    title?: string;
    keepChecklists?: boolean;
    keepMembers?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { name: 'bad-request', data: { message: 'Invalid JSON body' } } },
      { status: 400 },
    );
  }

  if (!body.targetListId) {
    return Response.json(
      { error: { name: 'bad-request', data: { message: 'targetListId is required' } } },
      { status: 400 },
    );
  }

  const targetList = await db('lists').where({ id: body.targetListId }).first();
  if (!targetList) {
    return Response.json(
      { error: { name: 'target-list-not-found', data: { message: 'Target list not found' } } },
      { status: 404 },
    );
  }

  const targetBoard = await db('boards').where({ id: targetList.board_id }).first();

  const targetCards = await db('cards')
    .where({ list_id: body.targetListId, archived: false })
    .orderBy('position', 'asc');

  const positionIdx =
    typeof body.position === 'number'
      ? Math.max(0, Math.min(body.position - 1, targetCards.length))
      : targetCards.length;

  const newPosition = computePosition(targetCards, positionIdx);
  const newId = randomUUID();
  const title =
    typeof body.title === 'string' && body.title.trim() ? body.title.trim() : card.title;

  // Fetch full row to access cover fields not included in the middleware type
  const fullCard = (await db('cards').where({ id: cardId }).first()) as CardRow;

  await db('cards').insert({
    id: newId,
    list_id: body.targetListId,
    title,
    description: card.description,
    position: newPosition,
    archived: false,
    due_date: card.due_date,
    cover_attachment_id: null,
    cover_color: fullCard.cover_color ?? null,
    cover_size: fullCard.cover_size ?? 'SMALL',
  });

  if (body.keepMembers) {
    const cardMembers = await db('card_members').where({ card_id: cardId });
    if (cardMembers.length > 0) {
      await db('card_members').insert(
        cardMembers.map((m: { user_id: string }) => ({ card_id: newId, user_id: m.user_id })),
      );
    }
  }

  if (body.keepChecklists) {
    await copyChecklists(cardId, newId);
  }

  const copy = await db('cards').where({ id: newId }).first();
  const copyWithCover = await resolveCoverImageUrl(
    copy as { id: string; cover_attachment_id?: string | null },
  );

  await dispatchEvent({
    type: 'card.copied',
    boardId: targetBoard?.id ?? board.id,
    entityId: newId,
    actorId: (req as AuthenticatedRequest).currentUser?.id ?? 'system',
    payload: { sourceId: cardId },
  });

  return Response.json({ data: copyWithCover }, { status: 201 });
}

