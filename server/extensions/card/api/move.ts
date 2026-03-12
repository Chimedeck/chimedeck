// PATCH /api/v1/cards/:id/move — move card to another list (or reorder within same list); min role: MEMBER.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { dispatchEvent } from '../../../mods/events/dispatch';
import { publisher } from '../../../mods/pubsub/publisher';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { requireCardWritable, type CardScopedRequest } from '../middlewares/requireCardWritable';
import { between, HIGH_SENTINEL } from '../../list/mods/fractional';
import { recordConflict } from '../../realtime/mods/conflictHandler';

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

  const roleError = requireRole(scopedReq, 'MEMBER');
  if (roleError) return roleError;

  let body: { targetListId: string; afterCardId?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (!body.targetListId) {
    return Response.json(
      { error: { code: 'bad-request', message: 'targetListId is required' } },
      { status: 400 },
    );
  }

  // Verify targetList exists and belongs to the same board
  const targetList = await db('lists').where({ id: body.targetListId }).first();
  if (!targetList) {
    return Response.json(
      { error: { code: 'target-list-not-found', message: 'Target list not found' } },
      { status: 404 },
    );
  }

  // Verify both lists belong to the same board (prevent cross-board moves)
  const sourceList = await db('lists').where({ id: card.list_id }).first();
  if (sourceList!.board_id !== targetList.board_id) {
    return Response.json(
      { error: { code: 'cross-board-move', message: 'Cannot move card to a list on a different board' } },
      { status: 400 },
    );
  }

  // Compute new position within target list
  const targetCards = await db('cards')
    .where({ list_id: body.targetListId, archived: false })
    .whereNot({ id: cardId }) // exclude the card being moved
    .orderBy('position', 'asc');

  let position: string;
  if (body.afterCardId === null || body.afterCardId === undefined) {
    // Prepend (null) or append (omitted — treat as append when undefined)
    if (body.afterCardId === null) {
      // Prepend before first card
      const first = targetCards[0];
      position = between('', first ? first.position : HIGH_SENTINEL);
    } else {
      // Append after last card
      const last = targetCards[targetCards.length - 1];
      position = between(last ? last.position : '', HIGH_SENTINEL);
    }
  } else {
    const afterIndex = targetCards.findIndex((c) => c.id === body.afterCardId);
    if (afterIndex === -1) {
      return Response.json(
        { error: { code: 'card-not-found', message: 'afterCardId not found in target list' } },
        { status: 404 },
      );
    }
    const after = targetCards[afterIndex]!;
    const next = targetCards[afterIndex + 1];
    position = between(after.position, next ? next.position : HIGH_SENTINEL);
  }

  const updated = await db('cards')
    .where({ id: cardId })
    .update({ list_id: body.targetListId, position, updated_at: new Date().toISOString() }, ['*']);

  // Detect position collision: if another card already occupies the computed position
  // (concurrent move race), record it as a conflict before broadcasting the resolution.
  const collision = await db('cards')
    .where({ list_id: body.targetListId, position, archived: false })
    .whereNot({ id: cardId })
    .first();
  if (collision) {
    recordConflict({ boardId: board.id, entityType: 'card' });
  }

  // Client expects { card, fromListId } to update both card slice and board slice
  const fromListId = card.list_id;
  await dispatchEvent({ type: 'card.moved', boardId: board.id, entityId: cardId, actorId: (req as AuthenticatedRequest).currentUser?.id ?? 'system', payload: { card: updated[0], fromListId, toListId: updated[0].list_id } });

  // Broadcast to all other board subscribers so their kanban updates in real time
  publisher.publish(
    board.id,
    JSON.stringify({ type: 'card_moved', payload: { card: updated[0], fromListId } }),
  ).catch(() => {});

  return Response.json({ data: updated[0] });
}
