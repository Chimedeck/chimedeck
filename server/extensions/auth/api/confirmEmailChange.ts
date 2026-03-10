// GET /api/v1/auth/confirm-email-change?token=<token>
// Public endpoint — verifies the change token, commits the new email, and invalidates all sessions.
import { db } from '../../../common/db';

export async function handleConfirmEmailChange(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return Response.json(
      { error: { code: 'invalid-or-expired-token', message: 'Token is required' } },
      { status: 400 },
    );
  }

  const user = await db('users').where({ email_change_token: token }).first();

  if (!user) {
    return Response.json(
      { error: { code: 'invalid-or-expired-token', message: 'Token is invalid or has expired' } },
      { status: 400 },
    );
  }

  const now = new Date();
  if (!user.email_change_token_expires_at || new Date(user.email_change_token_expires_at) < now) {
    return Response.json(
      { error: { code: 'invalid-or-expired-token', message: 'Token is invalid or has expired' } },
      { status: 400 },
    );
  }

  const newEmail = user.pending_email;
  if (!newEmail) {
    return Response.json(
      { error: { code: 'invalid-or-expired-token', message: 'No pending email change found' } },
      { status: 400 },
    );
  }

  // Re-check for race condition: another account may have claimed the email since the request
  const conflict = await db('users').where({ email: newEmail }).whereNot({ id: user.id }).first();
  if (conflict) {
    return Response.json(
      { error: { code: 'email-already-in-use', message: 'That email address is already in use' } },
      { status: 409 },
    );
  }

  // Commit the change and clear pending fields
  await db('users').where({ id: user.id }).update({
    email: newEmail,
    pending_email: null,
    email_change_token: null,
    email_change_token_expires_at: null,
  });

  // Invalidate all refresh tokens — email changed means re-login required
  await db('refresh_tokens').where({ user_id: user.id }).delete();

  return Response.json({ data: { confirmed: true } }, { status: 200 });
}
