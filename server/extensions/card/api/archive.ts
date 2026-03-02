// PATCH /api/v1/cards/:id/archive — toggle card archived state; min role: MEMBER.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';

export async function handleArchiveCard(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  // Load card directly (not via requireCardWritable — archive must work on archived cards too)
  const card = await db('cards').where({ id: cardId }).first();
  if (!card) {
    return Response.json(
      { name: 'card-not-found', data: { message: 'Card not found' } },
      { status: 404 },
    );
  }

  const list = await db('lists').where({ id: card.list_id }).first();
  const board = list ? await db('boards').where({ id: list.board_id }).first() : null;

  if (!list || !board) {
    return Response.json(
      { name: 'card-not-found', data: { message: 'Card context not found' } },
      { status: 404 },
    );
  }

  if (board.state === 'ARCHIVED') {
    return Response.json(
      { name: 'board-archived', data: { message: 'Board is archived and cannot be modified' } },
      { status: 403 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'MEMBER');
  if (roleError) return roleError;

  const newArchived = !card.archived;
  const updated = await db('cards')
    .where({ id: cardId })
    .update({ archived: newArchived, updated_at: new Date().toISOString() }, ['*']);

  console.log('[event] card_archived', { cardId, archived: newArchived });

  return Response.json({ data: updated[0] });
}
