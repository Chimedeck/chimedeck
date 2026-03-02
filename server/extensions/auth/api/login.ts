// POST /api/v1/auth/token — email/password login.
import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../../common/db';
import { verifyPassword } from '../mods/password/verify';
import { issueAccessToken } from '../mods/token/issue';
import { jwtConfig } from '../common/config/jwt';
import { memCache } from '../../../mods/cache';

// Rate limit: 10 login attempts per IP per minute.
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_SECONDS = 60;

function checkRateLimit(ip: string): boolean {
  const key = `rl:login:${ip}`;
  const count = memCache.incr(key, RATE_LIMIT_WINDOW_SECONDS);
  return count <= RATE_LIMIT_MAX;
}

export async function handleLogin(req: Request): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';

  if (!checkRateLimit(ip)) {
    return Response.json(
      { name: 'rate-limit-exceeded', data: { message: 'Too many login attempts' } },
      { status: 429 },
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'bad-request', data: { message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (!body.email || !body.password) {
    return Response.json(
      { name: 'credentials-invalid', data: { message: 'Email and password are required' } },
      { status: 401 },
    );
  }

  const user = await db('users').where({ email: body.email }).first();

  if (!user || !user.password_hash) {
    return Response.json(
      { name: 'credentials-invalid', data: { message: 'Invalid email or password' } },
      { status: 401 },
    );
  }

  const valid = await verifyPassword({ password: body.password, hash: user.password_hash });
  if (!valid) {
    return Response.json(
      { name: 'credentials-invalid', data: { message: 'Invalid email or password' } },
      { status: 401 },
    );
  }

  const accessToken = await issueAccessToken({ sub: user.id, email: user.email });

  // Issue opaque refresh token (32 random bytes).
  const refreshToken = randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + jwtConfig.refreshTokenTtlDays * 24 * 60 * 60 * 1000);

  await db('refresh_tokens').insert({
    id: uuidv4(),
    user_id: user.id,
    token: refreshToken,
    expires_at: expiresAt,
    created_at: now,
  });

  const responseHeaders = new Headers({ 'Content-Type': 'application/json' });
  // httpOnly Secure cookie for refresh token.
  responseHeaders.append(
    'Set-Cookie',
    `refresh_token=${refreshToken}; HttpOnly; Path=/api/v1/auth/refresh; SameSite=Strict; Max-Age=${jwtConfig.refreshTokenTtlDays * 86400}`,
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
