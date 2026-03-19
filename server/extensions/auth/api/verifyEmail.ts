// GET /api/v1/auth/verify-email?token=<token>
// Looks up user by verification token, validates expiry, marks user as verified, issues JWT.
import { randomBytes } from 'node:crypto';
import { generateId } from '../../../common/uuid';
import { db } from '../../../common/db';
import { issueAccessToken } from '../mods/token/issue';
import { jwtConfig } from '../common/config/jwt';
import { resolveAvatarUrl } from '../../../common/avatar/resolveAvatarUrl';

export async function handleVerifyEmail(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return Response.json(
      { error: { code: 'invalid-or-expired-token', message: 'Token is required' } },
      { status: 400 },
    );
  }

  const user = await db('users').where({ verification_token: token }).first();

  if (!user) {
    return Response.json(
      { error: { code: 'invalid-or-expired-token', message: 'Token is invalid or has expired' } },
      { status: 400 },
    );
  }

  const now = new Date();
  if (!user.verification_token_expires_at || new Date(user.verification_token_expires_at) < now) {
    return Response.json(
      { error: { code: 'invalid-or-expired-token', message: 'Token is invalid or has expired' } },
      { status: 400 },
    );
  }

  // Mark as verified and clear token fields
  await db('users').where({ id: user.id }).update({
    email_verified: true,
    verification_token: null,
    verification_token_expires_at: null,
  });

  const accessToken = await issueAccessToken({ sub: user.id, email: user.email });

  const refreshToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(now.getTime() + jwtConfig.refreshTokenTtlDays * 24 * 60 * 60 * 1000);

  await db('refresh_tokens').insert({
    id: generateId(),
    user_id: user.id,
    token: refreshToken,
    expires_at: expiresAt,
    created_at: now,
  });

  const responseHeaders = new Headers({ 'Content-Type': 'application/json' });
  responseHeaders.append(
    'Set-Cookie',
    `refresh_token=${refreshToken}; HttpOnly; Path=/api/v1/auth/refresh; SameSite=Strict; Max-Age=${jwtConfig.refreshTokenTtlDays * 86400}`,
  );

  const avatarUrl = await resolveAvatarUrl({ avatarUrl: user.avatar_url ?? null });

  return new Response(
    JSON.stringify({
      data: {
        accessToken,
        user: { id: user.id, email: user.email, name: user.name, avatarUrl },
      },
    }),
    { status: 200, headers: responseHeaders },
  );
}
