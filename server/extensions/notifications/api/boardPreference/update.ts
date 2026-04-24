// PATCH /api/v1/boards/:boardId/notification-preference
// Upserts the board-scoped notification preference for the authenticated user.
import { randomUUID } from 'node:crypto';
import { db } from '../../../../common/db';
import { type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { applyBoardVisibility, type BoardVisibilityScopedRequest } from '../../../../middlewares/boardVisibility';

interface PatchBody {
  notifications_enabled?: unknown;
  only_related_to_me?: unknown;
}

function invalidPreferencePatchResponse({
  name,
  message,
}: {
  name: string;
  message: string;
}): Response {
  return Response.json(
    {
      error: {
        name,
        data: { message },
      },
    },
    { status: 400 },
  );
}

function validatePatchBody({
  hasNotificationsEnabled,
  hasOnlyRelatedToMe,
  notificationsEnabled,
  onlyRelatedToMe,
}: {
  hasNotificationsEnabled: boolean;
  hasOnlyRelatedToMe: boolean;
  notificationsEnabled: unknown;
  onlyRelatedToMe: unknown;
}): Response | null {
  if (!hasNotificationsEnabled && !hasOnlyRelatedToMe) {
    return invalidPreferencePatchResponse({
      name: 'invalid-notification-preference-patch',
      message: 'At least one updatable field is required',
    });
  }

  if (hasNotificationsEnabled && typeof notificationsEnabled !== 'boolean') {
    return invalidPreferencePatchResponse({
      name: 'invalid-notifications-enabled',
      message: 'notifications_enabled must be a boolean',
    });
  }

  if (hasOnlyRelatedToMe && typeof onlyRelatedToMe !== 'boolean') {
    return invalidPreferencePatchResponse({
      name: 'invalid-only-related-to-me',
      message: 'only_related_to_me must be a boolean',
    });
  }

  return null;
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

  const { notifications_enabled, only_related_to_me } = body;

  const hasNotificationsEnabled = notifications_enabled !== undefined;
  const hasOnlyRelatedToMe = only_related_to_me !== undefined;

  const validationError = validatePatchBody({
    hasNotificationsEnabled,
    hasOnlyRelatedToMe,
    notificationsEnabled: notifications_enabled,
    onlyRelatedToMe: only_related_to_me,
  });
  if (validationError) return validationError;

  const now = new Date().toISOString();
  const existing = await db('board_notification_preferences')
    .where({ user_id: userId, board_id: resolvedBoardId })
    .select('notifications_enabled', 'only_related_to_me')
    .first();

  let nextNotificationsEnabled: boolean;
  if (hasNotificationsEnabled) {
    nextNotificationsEnabled = notifications_enabled as boolean;
  } else if (existing) {
    nextNotificationsEnabled = existing.notifications_enabled;
  } else {
    const [boardMember, boardGuest] = await Promise.all([
      db('board_members')
        .where({ board_id: resolvedBoardId, user_id: userId })
        .first(),
      db('board_guest_access')
        .where({ board_id: resolvedBoardId, user_id: userId })
        .first(),
    ]);
    nextNotificationsEnabled = !!boardMember || !!boardGuest;
  }

  let nextOnlyRelatedToMe = false;
  if (hasOnlyRelatedToMe) {
    nextOnlyRelatedToMe = only_related_to_me as boolean;
  } else if (existing) {
    nextOnlyRelatedToMe = existing.only_related_to_me ?? false;
  }

  let row: Record<string, unknown>;

  if (existing) {
    const [updated] = await db('board_notification_preferences')
      .where({ user_id: userId, board_id: resolvedBoardId })
      .update(
        {
          notifications_enabled: nextNotificationsEnabled,
          only_related_to_me: nextOnlyRelatedToMe,
          updated_at: now,
        },
        ['notifications_enabled', 'only_related_to_me', 'updated_at'],
      );
    row = updated;
  } else {
    const [inserted] = await db('board_notification_preferences').insert(
      {
        id: randomUUID(),
        user_id: userId,
        board_id: resolvedBoardId,
        notifications_enabled: nextNotificationsEnabled,
        only_related_to_me: nextOnlyRelatedToMe,
        updated_at: now,
      },
      ['notifications_enabled', 'only_related_to_me', 'updated_at'],
    );
    row = inserted;
  }

  return Response.json({
    data: {
      notifications_enabled: row.notifications_enabled,
      only_related_to_me: row.only_related_to_me,
      updated_at: row.updated_at,
    },
  });
}
