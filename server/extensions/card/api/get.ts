// GET /api/v1/cards/:id — get full card detail; min role: VIEWER.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';

export async function handleGetCard(req: Request, cardId: string): Promise<Response> {
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

  if (!list || !board) {
    return Response.json(
      { name: 'card-not-found', data: { message: 'Card context not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  // Populate extended fields (sprint 08)
  const labelRows = await db('labels')
    .join('card_labels', 'labels.id', 'card_labels.label_id')
    .where('card_labels.card_id', cardId)
    .select('labels.*');

  const memberRows = await db('users')
    .join('card_members', 'users.id', 'card_members.user_id')
    .where('card_members.card_id', cardId)
    .select('users.id', 'users.email', 'users.name');

  const checklistItems = await db('checklist_items')
    .where({ card_id: cardId })
    .orderBy('position', 'asc');

  return Response.json({
    data: card,
    includes: {
      list,
      board: { id: board.id, title: board.title },
      labels: labelRows,
      members: memberRows,
      checklistItems,
      comments: [],
      attachments: [],
      activities: [],
    },
  });
}
