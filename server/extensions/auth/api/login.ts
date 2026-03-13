// POST /api/v1/auth/token — email/password login.
import { randomBytes } from 'node:crypto';
import { generateId } from '../../../common/uuid';
import { db } from '../../../common/db';
import { verifyPassword } from '../mods/password/verify';
import { issueAccessToken } from '../mods/token/issue';
import { jwtConfig } from '../common/config/jwt';
import { memCache } from '../../../mods/cache';
import { flags } from '../../../mods/flags';
import { send } from '../../email';
import { buildVerificationEmail } from '../../email/templates/verificationEmail';
import { env } from '../../../config/env';

// Rate limit: 10 login attempts per IP per minute.
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const VERIFICATION_RESEND_RATE_LIMIT = 3;
const VERIFICATION_RESEND_WINDOW_SECONDS = 3600;

function checkRateLimit(ip: string): boolean {
  const key = `rl:login:${ip}`;
  const count = memCache.incr(key, RATE_LIMIT_WINDOW_SECONDS);
  return count <= RATE_LIMIT_MAX;
}

async function resendVerificationEmailForUser(user: { id: string; email: string }): Promise<boolean> {
  const rlKey = `rl:login-resend-verification:${user.id}`;
  const count = memCache.incr(rlKey, VERIFICATION_RESEND_WINDOW_SECONDS);
  if (count > VERIFICATION_RESEND_RATE_LIMIT) return false;

  const verificationToken = randomBytes(32).toString('hex');
  const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db('users').where({ id: user.id }).update({
    verification_token: verificationToken,
    verification_token_expires_at: verificationTokenExpiresAt,
  });

  const verificationUrl = `${env.APP_URL}/verify-email?token=${verificationToken}`;
  const emailContent = buildVerificationEmail({ verificationUrl });
  await send({ to: user.email, ...emailContent });

  return true;
}

export async function handleLogin(req: Request): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';

  if (!checkRateLimit(ip)) {
    return Response.json(
      { error: { code: 'rate-limit-exceeded', message: 'Too many login attempts' } },
      { status: 429 },
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (!body.email || !body.password) {
    return Response.json(
      { error: { code: 'credentials-invalid', message: 'Email and password are required' } },
      { status: 401 },
    );
  }

  const user = await db('users').where({ email: body.email }).first();

  if (!user?.password_hash) {
    return Response.json(
      { error: { code: 'credentials-invalid', message: 'Invalid email or password' } },
      { status: 401 },
    );
  }

  const valid = await verifyPassword({ password: body.password, hash: user.password_hash });
  if (!valid) {
    return Response.json(
      { error: { code: 'credentials-invalid', message: 'Invalid email or password' } },
      { status: 401 },
    );
  }

  // Block login for unverified users when the feature flag is enabled.
  // Also attempt to send a fresh verification email from the login flow.
  const verificationEnabled = await flags.isEnabled('EMAIL_VERIFICATION_ENABLED');
  if (verificationEnabled && !user.email_verified) {
    let verificationEmailSent = false;
    try {
      verificationEmailSent = await resendVerificationEmailForUser({ id: user.id, email: user.email });
    } catch {
      verificationEmailSent = false;
    }

    return Response.json(
      {
        error: {
          code: 'email-not-verified',
          message: 'Please verify your email before logging in.',
          data: { verificationEmailSent },
        },
      },
      { status: 403 },
    );
  }

  const accessToken = await issueAccessToken({ sub: user.id, email: user.email });

  // Issue opaque refresh token (32 random bytes).
  const refreshToken = randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + jwtConfig.refreshTokenTtlDays * 24 * 60 * 60 * 1000);

  await db('refresh_tokens').insert({
    id: generateId(),
    user_id: user.id,
    token: refreshToken,
    expires_at: expiresAt,
    created_at: now,
  });

  const responseHeaders = new Headers({ 'Content-Type': 'application/json' });
  // httpOnly Secure cookie for refresh token.
  responseHeaders.append(
    'Set-Cookie',
    `refresh_token=${refreshToken}; HttpOnly; Path=/api/v1/auth/refresh; SameSite=Strict; Secure; Max-Age=${jwtConfig.refreshTokenTtlDays * 86400}`,
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
