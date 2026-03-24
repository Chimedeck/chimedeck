// DELETE /api/v1/cards/:id — hard-delete a card; min role: ADMIN.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { dispatchEvent } from '../../../mods/events/dispatch';
import { dispatchDirectCardNotification } from '../../notifications/mods/boardActivityDispatch';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';

export async function handleDeleteCard(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

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
      { error: { code: 'board-is-archived', message: 'This board is archived and cannot be modified.' } },
      { status: 403 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'ADMIN');
  if (roleError) return roleError;

  const actorId = (req as AuthenticatedRequest).currentUser?.id ?? 'system';

  // Fire-and-forget card_deleted notification before row removal so card data is still accessible
  dispatchDirectCardNotification({
    payload: { type: 'card_deleted', cardTitle: card.title },
    boardId: board.id,
    cardId,
    actorId,
  }).catch(() => {});

  await db('cards').where({ id: cardId }).del();

  await dispatchEvent({ type: 'card.deleted', boardId: list.board_id, entityId: cardId, actorId, payload: { listId: card.list_id } });

  return new Response(null, { status: 204 });
}
