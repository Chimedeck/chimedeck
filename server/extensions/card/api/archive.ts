// PATCH /api/v1/cards/:id/archive — toggle card archived state; min role: MEMBER.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { dispatchEvent } from '../../../mods/events/dispatch';
import { dispatchDirectCardNotification } from '../../notifications/mods/boardActivityDispatch';
import {
  requireWorkspaceMembership,
  requireMemberOrBoardGuestMember,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';

export async function handleArchiveCard(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  // Load card directly (not via requireCardWritable — archive must work on archived cards too)
  const card = await db('cards').where({ id: cardId }).first();
  if (!card) {
    return Response.json(
      { error: { code: 'card-not-found', message: 'Card not found' } },
      { status: 404 },
    );
  }

  const list = await db('lists').where({ id: card.list_id }).first();
  const board = list ? await db('boards').where({ id: list.board_id }).first() : null;

  if (!list || !board) {
    return Response.json(
      { error: { code: 'card-not-found', message: 'Card context not found' } },
      { status: 404 },
    );
  }

  if (board.state === 'ARCHIVED') {
    return Response.json(
      { error: { code: 'board-archived', message: 'Board is archived and cannot be modified' } },
      { status: 403 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const roleError = await requireMemberOrBoardGuestMember(scopedReq, board.id);
  if (roleError) return roleError;

  const newArchived = !card.archived;
  const updated = await db('cards')
    .where({ id: cardId })
    .update({ archived: newArchived, updated_at: new Date().toISOString() }, ['*']);

  // Client expects { cardId, listId } to remove card from board state
  await dispatchEvent({ type: 'card.archived', boardId: board.id, entityId: cardId, actorId: (req as AuthenticatedRequest).currentUser?.id ?? 'system', payload: { cardId, listId: card.list_id } });

  // Fire-and-forget card_archived notification with the new archived state
  const actorId = (req as AuthenticatedRequest).currentUser?.id ?? 'system';
  dispatchDirectCardNotification({
    payload: { type: 'card_archived', cardTitle: card.title, archived: newArchived },
    boardId: board.id,
    cardId,
    actorId,
  }).catch(() => {});

  return Response.json({ data: updated[0] });
}
