// PATCH /api/v1/boards/:boardId/notification-preference
// Upserts the board-scoped notification preference for the authenticated user.
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';

interface PatchBody {
  notifications_enabled?: unknown;
}

export async function handleUpdateBoardNotificationPreference(
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
    .where({ user_id: userId, board_id: boardId })
    .first();

  let row: Record<string, unknown>;

  if (existing) {
    const [updated] = await db('board_notification_preferences')
      .where({ user_id: userId, board_id: boardId })
      .update({ notifications_enabled, updated_at: now }, ['notifications_enabled', 'updated_at']);
    row = updated;
  } else {
    const [inserted] = await db('board_notification_preferences').insert(
      { user_id: userId, board_id: boardId, notifications_enabled, updated_at: now },
      ['notifications_enabled', 'updated_at'],
    );
    row = inserted;
  }

  return Response.json({ data: { notifications_enabled: row.notifications_enabled, updated_at: row.updated_at } });
}
