// PATCH /api/v1/boards/:boardId/notification-preferences/types
// Upserts a single board_notification_type_preferences row for the authenticated user.
// Returns the updated full list (same shape as GET).
import { randomUUID } from 'crypto';
import { db } from '../../../../common/db';
import { type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { applyBoardVisibility } from '../../../../middlewares/boardVisibility';
import { NOTIFICATION_TYPES } from '../../mods/preferenceGuard';
import { handleGetBoardTypePreferences } from './get';

interface PatchBody {
  type?: unknown;
  in_app_enabled?: unknown;
  email_enabled?: unknown;
}

export async function handleUpdateBoardTypePreference(
  req: Request,
  boardId: string,
): Promise<Response> {
  const visibilityError = await applyBoardVisibility(req, boardId);
  if (visibilityError) return visibilityError;

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

  const { type, in_app_enabled, email_enabled } = body;

  if (typeof type !== 'string' || !(NOTIFICATION_TYPES as readonly string[]).includes(type)) {
    return Response.json(
      {
        error: {
          name: 'invalid-notification-type',
          data: { message: `type must be one of: ${NOTIFICATION_TYPES.join(', ')}` },
        },
      },
      { status: 400 },
    );
  }

  if (in_app_enabled === undefined && email_enabled === undefined) {
    return Response.json(
      {
        error: {
          name: 'missing-preference-fields',
          data: { message: 'Provide at least one of: in_app_enabled, email_enabled' },
        },
      },
      { status: 400 },
    );
  }

  if (in_app_enabled !== undefined && typeof in_app_enabled !== 'boolean') {
    return Response.json(
      {
        error: {
          name: 'invalid-in-app-enabled',
          data: { message: 'in_app_enabled must be a boolean' },
        },
      },
      { status: 400 },
    );
  }

  if (email_enabled !== undefined && typeof email_enabled !== 'boolean') {
    return Response.json(
      {
        error: {
          name: 'invalid-email-enabled',
          data: { message: 'email_enabled must be a boolean' },
        },
      },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const existing = await db('board_notification_type_preferences')
    .where({ user_id: userId, board_id: boardId, type })
    .first();

  if (existing) {
    const updates: Record<string, unknown> = { updated_at: now };
    if (in_app_enabled !== undefined) updates.in_app_enabled = in_app_enabled;
    if (email_enabled !== undefined) updates.email_enabled = email_enabled;

    await db('board_notification_type_preferences')
      .where({ user_id: userId, board_id: boardId, type })
      .update(updates);
  } else {
    await db('board_notification_type_preferences').insert({
      id: randomUUID(),
      user_id: userId,
      board_id: boardId,
      type,
      in_app_enabled: in_app_enabled ?? true,
      email_enabled: email_enabled ?? true,
      updated_at: now,
    });
  }

  // Return the updated full list (same shape as GET).
  return handleGetBoardTypePreferences(req, boardId);
}
