// GET /api/v1/boards/:id/archived-cards — all archived cards in a board.
// PUBLIC boards: no auth required. WORKSPACE/PRIVATE: min role VIEWER.
import { db } from '../../../common/db';
import {
  requireRole,
} from '../../../middlewares/permissionManager';
import {
  applyBoardVisibility,
  type BoardVisibilityScopedRequest,
} from '../../../middlewares/boardVisibility';

export async function handleGetArchivedCards(req: Request, boardId: string): Promise<Response> {
  const visibilityError = await applyBoardVisibility(req, boardId);
  if (visibilityError) return visibilityError;

  const scopedReq = req as BoardVisibilityScopedRequest;
  const board = scopedReq.board!;

  if (board.visibility !== 'PUBLIC') {
    const roleError = requireRole(scopedReq, 'VIEWER');
    if (roleError) return roleError;
  }

  const cards = await db('cards')
    .join('lists', 'cards.list_id', 'lists.id')
    .where('lists.board_id', boardId)
    .where('cards.archived', true)
    .orderBy('cards.updated_at', 'desc')
    .select(
      'cards.id',
      'cards.list_id',
      'cards.title',
      'cards.description',
      'cards.position',
      'cards.archived',
      'cards.start_date',
      'cards.due_date',
      'cards.created_at',
      'cards.updated_at',
      'lists.title as list_title',
    );

  return Response.json({ data: cards });
}
