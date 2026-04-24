// GET /api/v1/boards/:boardId/notification-preference
// Returns the board-scoped notification preference for the authenticated user.
// Missing row defaults to notifications_enabled: true (opt-out model).
import { db } from '../../../../common/db';
import { type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { applyBoardVisibility, type BoardVisibilityScopedRequest } from '../../../../middlewares/boardVisibility';

export async function handleGetBoardNotificationPreference(
  req: Request,
  boardId: string,
): Promise<Response> {
  const visibilityError = await applyBoardVisibility(req, boardId);
  if (visibilityError) return visibilityError;
  const resolvedBoardId = (req as BoardVisibilityScopedRequest).board!.id;

  const userId = (req as AuthenticatedRequest).currentUser!.id;

  // [why] Notifications apply to board participants (joined members OR board guests).
  // Non-participants (e.g. admins who can view a board via workspace visibility)
  // still default to OFF unless they explicitly opt in.
  const [boardMember, boardGuest] = await Promise.all([
    db('board_members')
      .where({ board_id: resolvedBoardId, user_id: userId })
      .first(),
    db('board_guest_access')
      .where({ board_id: resolvedBoardId, user_id: userId })
      .first(),
  ]);

  const row = await db('board_notification_preferences')
    .where({ user_id: userId, board_id: resolvedBoardId })
    .select('notifications_enabled', 'only_related_to_me', 'updated_at')
    .first();

  return Response.json({
    data: {
      notifications_enabled: row ? row.notifications_enabled : !!boardMember || !!boardGuest,
      only_related_to_me: row ? row.only_related_to_me : false,
      updated_at: row ? row.updated_at : null,
    },
  });
}
