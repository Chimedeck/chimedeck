// GET /api/v1/boards/:boardId/notification-preferences/types
// Returns all notification types with resolved values for the authenticated user.
// Cascade: board-type-pref → user-type-pref → default (true).
// The 'source' field indicates which level provided the value.
import { db } from '../../../../common/db';
import { type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { applyBoardVisibility } from '../../../../middlewares/boardVisibility';
import { NOTIFICATION_TYPES } from '../../mods/preferenceGuard';

export async function handleGetBoardTypePreferences(
  req: Request,
  boardId: string,
): Promise<Response> {
  const visibilityError = await applyBoardVisibility(req, boardId);
  if (visibilityError) return visibilityError;

  const userId = (req as AuthenticatedRequest).currentUser!.id;

  const [boardRows, userRows] = await Promise.all([
    db('board_notification_type_preferences')
      .where({ user_id: userId, board_id: boardId })
      .select('type', 'in_app_enabled', 'email_enabled'),
    db('notification_preferences')
      .where({ user_id: userId })
      .select('type', 'in_app_enabled', 'email_enabled'),
  ]);

  const boardByType = new Map(boardRows.map((r: { type: string; in_app_enabled: boolean; email_enabled: boolean }) => [r.type, r]));
  const userByType = new Map(userRows.map((r: { type: string; in_app_enabled: boolean; email_enabled: boolean }) => [r.type, r]));

  const data = NOTIFICATION_TYPES.map((type) => {
    const boardRow = boardByType.get(type);
    if (boardRow) {
      return {
        type,
        in_app_enabled: boardRow.in_app_enabled,
        email_enabled: boardRow.email_enabled,
        source: 'board' as const,
      };
    }

    const userRow = userByType.get(type);
    if (userRow) {
      return {
        type,
        in_app_enabled: userRow.in_app_enabled,
        email_enabled: userRow.email_enabled,
        source: 'user' as const,
      };
    }

    return {
      type,
      in_app_enabled: true,
      email_enabled: true,
      source: 'default' as const,
    };
  });

  return Response.json({ data });
}
