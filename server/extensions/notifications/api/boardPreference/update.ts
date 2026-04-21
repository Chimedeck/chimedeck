// PATCH /api/v1/boards/:boardId/notification-preference
// Upserts the board-scoped notification preference for the authenticated user.
import { randomUUID } from 'node:crypto';
import { db } from '../../../../common/db';
import { type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { applyBoardVisibility, type BoardVisibilityScopedRequest } from '../../../../middlewares/boardVisibility';

interface PatchBody {
  notifications_enabled?: unknown;
}

export async function handleUpdateBoardNotificationPreference(
  req: Request,
  boardId: string,
): Promise<Response> {
  const visibilityError = await applyBoardVisibility(req, boardId);
  if (visibilityError) return visibilityError;
  const resolvedBoardId = (req as BoardVisibilityScopedRequest).board!.id;

  const userId = (req as AuthenticatedRequest).currentUser!.id;

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: { name: 'invalid-request-body', data: { message: 'Invalid JSON body' } } },
      { status: 400 },
    );
  }

  const { notifications_enabled } = body;

  if (typeof notifications_enabled !== 'boolean') {
    return Response.json(
      {
        error: {
          name: 'invalid-notifications-enabled',
          data: { message: 'notifications_enabled must be a boolean' },
        },
      },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const existing = await db('board_notification_preferences')
    .where({ user_id: userId, board_id: resolvedBoardId })
    .first();

  let row: Record<string, unknown>;

  if (existing) {
    const [updated] = await db('board_notification_preferences')
      .where({ user_id: userId, board_id: resolvedBoardId })
      .update({ notifications_enabled, updated_at: now }, ['notifications_enabled', 'updated_at']);
    row = updated;
  } else {
    const [inserted] = await db('board_notification_preferences').insert(
      { id: randomUUID(), user_id: userId, board_id: resolvedBoardId, notifications_enabled, updated_at: now },
      ['notifications_enabled', 'updated_at'],
    );
    row = inserted;
  }

  return Response.json({ data: { notifications_enabled: row.notifications_enabled, updated_at: row.updated_at } });
}
