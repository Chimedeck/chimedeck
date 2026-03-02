// POST /api/v1/auth/refresh — rotate refresh token (reads httpOnly cookie).
import { db } from '../../../common/db';
import { rotateRefreshToken } from '../mods/token/refresh';
import { issueAccessToken } from '../mods/token/issue';
import { jwtConfig } from '../common/config/jwt';

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

export async function handleRefresh(req: Request): Promise<Response> {
  const cookieHeader = req.headers.get('cookie');
  const refreshToken = parseCookie(cookieHeader, 'refresh_token');

  if (!refreshToken) {
    return Response.json(
      { name: 'refresh-token-invalid', data: { message: 'No refresh token cookie present' } },
      { status: 401 },
    );
  }

  const result = await rotateRefreshToken({ token: refreshToken });

  if (result.status !== 200 || !result.token || !result.userId) {
    return Response.json(
      { name: 'refresh-token-invalid', data: { message: 'Refresh token expired or revoked' } },
      { status: 401 },
    );
  }

  const user = await db('users').where({ id: result.userId }).first();
  if (!user) {
    return Response.json(
      { name: 'user-not-found', data: { message: 'User no longer exists' } },
      { status: 404 },
    );
  }

  const accessToken = await issueAccessToken({ sub: user.id, email: user.email });

  const responseHeaders = new Headers({ 'Content-Type': 'application/json' });
  responseHeaders.append(
    'Set-Cookie',
    `refresh_token=${result.token}; HttpOnly; Path=/api/v1/auth/refresh; SameSite=Strict; Max-Age=${jwtConfig.refreshTokenTtlDays * 86400}`,
  );

  return new Response(
    JSON.stringify({
      data: {
        accessToken,
        user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatar_url ?? null },
      },
    }),
    { status: 200, headers: responseHeaders },
  );
}
