// GET /api/v1/cards/:id/comments — list comments for a card; min role: MEMBER.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';

export async function handleListComments(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const card = await db('cards').where({ id: cardId }).first();
  if (!card) {
    return Response.json(
      { name: 'card-not-found', data: { message: 'Card not found' } },
      { status: 404 },
    );
  }

  const list = await db('lists').where({ id: card.list_id }).first();
  const board = list ? await db('boards').where({ id: list.board_id }).first() : null;
  if (!board) {
    return Response.json(
      { name: 'board-not-found', data: { message: 'Board not found' } },
      { status: 404 },
    );
  }

  // Verify workspace membership
  const membershipError = await requireWorkspaceMembership(
    req as WorkspaceScopedRequest,
    board.workspace_id,
  );
  if (membershipError) return membershipError;

  const comments = await db('comments')
    .where({ card_id: cardId })
    .orderBy('created_at', 'asc');

  return Response.json({ data: comments });
}
