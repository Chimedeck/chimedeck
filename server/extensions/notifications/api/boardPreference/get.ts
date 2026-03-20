// GET /api/v1/boards/:boardId/notification-preference
// Returns the board-scoped notification preference for the authenticated user.
// Missing row defaults to notifications_enabled: true (opt-out model).
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';

export async function handleGetBoardNotificationPreference(
  req: Request,
  boardId: string,
): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const userId = (req as AuthenticatedRequest).currentUser!.id;

  // Verify the user is a board member.
  const membership = await db('board_members').where({ board_id: boardId, user_id: userId }).first();
  if (!membership) {
    return Response.json(
      { error: { name: 'not-a-board-member', data: { message: 'You are not a member of this board' } } },
      { status: 403 },
    );
  }

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
