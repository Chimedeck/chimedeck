// POST /api/v1/auth/reset-password
// Public endpoint — validates the reset token, sets a new password, and invalidates all sessions.
import { db } from '../../../common/db';
import { hashPassword } from '../mods/password/hash';
import { pubsub } from '../../../mods/pubsub/index';

export async function handleResetPassword(req: Request): Promise<Response> {
  let body: { token?: string; password?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (!body.token || !body.password) {
    return Response.json(
      { error: { code: 'bad-request', message: 'token and password are required' } },
      { status: 400 },
    );
  }

  const user = await db('users').where({ password_reset_token: body.token }).first();

  if (!user) {
    return Response.json(
      { error: { code: 'invalid-or-expired-token', message: 'Token is invalid or has expired' } },
      { status: 400 },
    );
  }

  const now = new Date();
  if (!user.password_reset_token_expires_at || new Date(user.password_reset_token_expires_at) < now) {
    return Response.json(
      { error: { code: 'invalid-or-expired-token', message: 'Token is invalid or has expired' } },
      { status: 400 },
    );
  }

  // Validate password strength: min 8 chars, at least one letter and one number
  const { password } = body;
  if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return Response.json(
      { error: { code: 'password-too-weak', message: 'Password must be at least 8 characters and contain a letter and a number' } },
      { status: 422 },
    );
  }

  const passwordHash = await hashPassword({ password });

  // Update password and clear reset token fields
  await db('users').where({ id: user.id }).update({
    password_hash: passwordHash,
    password_reset_token: null,
    password_reset_token_expires_at: null,
  });

  // Invalidate all refresh tokens — password changed means re-login required.
  await db('refresh_tokens').where({ user_id: user.id }).delete();

  // Notify any open WebSocket connections for this user to close (code 4001).
  await pubsub.publish(
    `session:${user.id}`,
    JSON.stringify({ type: 'session_revoked' }),
  );

  return Response.json({ data: { reset: true } }, { status: 200 });
}
