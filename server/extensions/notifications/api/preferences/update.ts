// PATCH /api/v1/notifications/preferences
// Upserts notification preference for a given type for the authenticated user.
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { NOTIFICATION_TYPES } from '../../mods/preferenceGuard';

interface PatchBody {
  type?: unknown;
  in_app_enabled?: unknown;
  email_enabled?: unknown;
}

export async function handleUpdatePreferences(req: Request): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

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
  const existing = await db('notification_preferences').where({ user_id: userId, type }).first();

  let row: Record<string, unknown>;

  if (existing) {
    const updates: Record<string, unknown> = { updated_at: now };
    if (in_app_enabled !== undefined) updates.in_app_enabled = in_app_enabled;
    if (email_enabled !== undefined) updates.email_enabled = email_enabled;

    const [updated] = await db('notification_preferences')
      .where({ user_id: userId, type })
      .update(updates, ['type', 'in_app_enabled', 'email_enabled', 'updated_at']);
    row = updated;
  } else {
    const insert: Record<string, unknown> = {
      user_id: userId,
      type,
      in_app_enabled: in_app_enabled ?? true,
      email_enabled: email_enabled ?? true,
      updated_at: now,
    };

    const [inserted] = await db('notification_preferences').insert(
      insert,
      ['type', 'in_app_enabled', 'email_enabled', 'updated_at'],
    );
    row = inserted;
  }

  return Response.json({ data: row });
}
