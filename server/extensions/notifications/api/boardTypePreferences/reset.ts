// DELETE /api/v1/boards/:boardId/notification-preferences/types
// Removes all board_notification_type_preferences rows for the authenticated user on this board.
// After deletion the user's preferences fall back to their master config (user-level or default).
import { db } from '../../../../common/db';
import { type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { applyBoardVisibility, type BoardVisibilityScopedRequest } from '../../../../middlewares/boardVisibility';

export async function handleResetBoardTypePreferences(
  req: Request,
  boardId: string,
): Promise<Response> {
  const visibilityError = await applyBoardVisibility(req, boardId);
  if (visibilityError) return visibilityError;
  const resolvedBoardId = (req as BoardVisibilityScopedRequest).board!.id;

  const userId = (req as AuthenticatedRequest).currentUser!.id;

  await db('board_notification_type_preferences').where({ user_id: userId, board_id: resolvedBoardId }).delete();

  return Response.json({ data: {} });
}
