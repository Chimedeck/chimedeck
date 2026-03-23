// GET /api/v1/boards/:boardId/notification-preference
// Returns the board-scoped notification preference for the authenticated user.
// Missing row defaults to notifications_enabled: true (opt-out model).
import { db } from '../../../../common/db';
import { type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { applyBoardVisibility } from '../../../../middlewares/boardVisibility';

export async function handleGetBoardNotificationPreference(
  req: Request,
  boardId: string,
): Promise<Response> {
  const visibilityError = await applyBoardVisibility(req, boardId);
  if (visibilityError) return visibilityError;

  const userId = (req as AuthenticatedRequest).currentUser!.id;

  const row = await db('board_notification_preferences')
    .where({ user_id: userId, board_id: boardId })
    .select('notifications_enabled', 'updated_at')
    .first();

  return Response.json({
    data: {
      notifications_enabled: row ? row.notifications_enabled : true,
      updated_at: row ? row.updated_at : null,
    },
  });
}
