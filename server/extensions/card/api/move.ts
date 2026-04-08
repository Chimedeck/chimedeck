// PATCH /api/v1/cards/:id/move — move card to another list (or reorder within same list); min role: MEMBER.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { dispatchEvent } from '../../../mods/events/dispatch';
import { publisher } from '../../../mods/pubsub/publisher';
import {
  requireWorkspaceMembership,
  requireMemberOrBoardGuestMember,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { requireCardWritable, type CardScopedRequest } from '../middlewares/requireCardWritable';
import { between, HIGH_SENTINEL, generatePositions } from '../../list/mods/fractional';
import { recordConflict } from '../../realtime/mods/conflictHandler';
import { emitCardMoved } from '../../activity/mods/createActivityEvent';

type MoveBody = { targetListId: string; afterCardId?: string | null };

type CardRow = {
  id: string;
  list_id: string;
  position: string;
  title: string;
  [key: string]: unknown;
};

type ListRow = {
  id: string;
  board_id: string;
  title?: string | null;
  [key: string]: unknown;
};

async function parseMoveBody(req: Request): Promise<MoveBody | Response> {
  try {
    const body = (await req.json()) as MoveBody;
    if (!body.targetListId) {
      return Response.json(
        { error: { code: 'bad-request', message: 'targetListId is required' } },
        { status: 400 },
      );
    }
    return body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }
}

async function validateMoveLists({
  card,
  targetListId,
}: {
  card: { list_id: string };
  targetListId: string;
}): Promise<{ targetList: ListRow; sourceList: ListRow } | Response> {
  const targetList = (await db('lists').where({ id: targetListId }).first()) as ListRow | undefined;
  if (!targetList) {
    return Response.json(
      { error: { code: 'target-list-not-found', message: 'Target list not found' } },
      { status: 404 },
    );
  }

  const sourceList = (await db('lists').where({ id: card.list_id }).first()) as ListRow | undefined;
  if (sourceList?.board_id !== targetList.board_id) {
    return Response.json(
      { error: { code: 'cross-board-move', message: 'Cannot move card to a list on a different board' } },
      { status: 400 },
    );
  }

  return { targetList, sourceList };
}

function resolveInsertIndex({
  afterCardId,
  targetCards,
}: {
  afterCardId: string | null | undefined;
  targetCards: CardRow[];
}): number | null {
  if (afterCardId === null) return 0;
  if (afterCardId === undefined) return targetCards.length;
  const afterIndex = targetCards.findIndex((c) => c.id === afterCardId);
  return afterIndex === -1 ? null : afterIndex + 1;
}

function computeStrictPositionBetween({ left, right }: { left: string; right: string }): string | null {
  try {
    const candidate = between(left, right);
    const leftOk = left === '' ? true : left < candidate;
    const rightOk = right === HIGH_SENTINEL ? candidate < HIGH_SENTINEL : candidate < right;
    return leftOk && rightOk ? candidate : null;
  } catch {
    return null;
  }
}

async function rebalanceAndMoveCard({
  cardId,
  targetListId,
  insertIndex,
  targetCards,
  now,
}: {
  cardId: string;
  targetListId: string;
  insertIndex: number;
  targetCards: CardRow[];
  now: string;
}): Promise<CardRow | null> {
  const orderedIds = [
    ...targetCards.slice(0, insertIndex).map((c) => c.id),
    cardId,
    ...targetCards.slice(insertIndex).map((c) => c.id),
  ];
  const newPositions = generatePositions(orderedIds.length);

  await db.transaction(async (trx) => {
    await Promise.all(
      orderedIds.map((id, idx) => {
        const updateData: { position: string; updated_at: string; list_id?: string } = {
          position: newPositions[idx]!,
          updated_at: now,
        };
        if (id === cardId) {
          updateData.list_id = targetListId;
        }
        return trx('cards').where({ id }).update(updateData);
      }),
    );
  });

  const refreshed = await db('cards').where({ id: cardId }).first();
  return (refreshed as CardRow | undefined) ?? null;
}

async function persistMove({
  cardId,
  targetListId,
  insertIndex,
  targetCards,
  now,
  position,
}: {
  cardId: string;
  targetListId: string;
  insertIndex: number;
  targetCards: CardRow[];
  now: string;
  position: string | null;
}): Promise<CardRow | null> {
  if (position === null) {
    return rebalanceAndMoveCard({ cardId, targetListId, insertIndex, targetCards, now });
  }

  const updated = await db('cards')
    .where({ id: cardId })
    .update({ list_id: targetListId, position, updated_at: now }, ['*']);
  return (updated[0] as CardRow | undefined) ?? null;
}

export async function handleMoveCard(req: Request, cardId: string): Promise<Response> {
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

  const bodyOrError = await parseMoveBody(req);
  if (bodyOrError instanceof Response) return bodyOrError;
  const body = bodyOrError;

  const listsOrError = await validateMoveLists({ card, targetListId: body.targetListId });
  if (listsOrError instanceof Response) return listsOrError;
  const { targetList, sourceList } = listsOrError;

  // Compute new position within target list
  const targetCards = (await db('cards')
    .where({ list_id: body.targetListId, archived: false })
    .whereNot({ id: cardId }) // exclude the card being moved
    .orderBy('position', 'asc')) as CardRow[];

  const insertIndex = resolveInsertIndex({ afterCardId: body.afterCardId, targetCards });
  if (insertIndex === null) {
    return Response.json(
      { error: { code: 'card-not-found', message: 'afterCardId not found in target list' } },
      { status: 404 },
    );
  }

  const left = insertIndex > 0 ? targetCards[insertIndex - 1]?.position ?? '' : '';
  const right = insertIndex < targetCards.length
    ? targetCards[insertIndex]?.position ?? HIGH_SENTINEL
    : HIGH_SENTINEL;

  let position = computeStrictPositionBetween({ left, right });

  const now = new Date().toISOString();
  // Boundary fallback: if no strict lexicographic slot exists (e.g. prepend
  // before a '!' card), persistMove re-spaces the target list before applying.
  const updatedCard = await persistMove({
    cardId,
    targetListId: body.targetListId,
    insertIndex,
    targetCards,
    now,
    position,
  });
  if (!updatedCard) {
    return Response.json(
      { error: { code: 'card-not-found', message: 'Card not found after move' } },
      { status: 404 },
    );
  }
  position = updatedCard.position;

  // Detect position collision: if another card already occupies the computed position
  // (concurrent move race), record it as a conflict before broadcasting the resolution.
  const collision = await db('cards')
    .where({ list_id: body.targetListId, position, archived: false })
    .whereNot({ id: cardId })
    .first();
  collision && recordConflict({ boardId: board.id, entityType: 'card' });

  // Client expects { card, fromListId } to update both card slice and board slice
  const fromListId = card.list_id;
  const actorId = (req as AuthenticatedRequest).currentUser?.id ?? 'system';

  await Promise.all([
    dispatchEvent({ type: 'card.moved', boardId: board.id, entityId: cardId, actorId, payload: { card: updatedCard, fromListId, toListId: updatedCard.list_id } }),
    emitCardMoved({
      actorId,
      cardId,
      cardTitle: updatedCard.title,
      fromListId,
      fromListName: sourceList!.title ?? null,
      toListId: updatedCard.list_id,
      toListName: targetList.title ?? null,
      boardId: board.id,
      workspaceId: board.workspace_id,
      ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? null,
      userAgent: req.headers.get('user-agent') ?? null,
    }),
  ]);

  // Broadcast to all other board subscribers so their kanban updates in real time
  publisher.publish(
    board.id,
    JSON.stringify({ type: 'card_moved', payload: { card: updatedCard, fromListId } }),
  ).catch(() => {});

  return Response.json({ data: updatedCard });
}
