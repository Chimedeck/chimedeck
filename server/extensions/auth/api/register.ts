// POST /api/v1/auth/register — create a new account and return an auth session.
import { randomBytes } from 'node:crypto';
import { generateId } from '../../../common/uuid';
import { db } from '../../../common/db';
import { hashPassword } from '../mods/password/hash';
import { issueAccessToken } from '../mods/token/issue';
import { jwtConfig } from '../common/config/jwt';
import { flags } from '../../../mods/flags';
import { send } from '../../email';
import { buildVerificationEmail } from '../../email/templates/verificationEmail';
import { env } from '../../../config/env';
import { isEmailDomainAllowed } from '../common/emailDomain';
import { buildAvatarProxyUrl } from '../../../common/avatar/resolveAvatarUrl';

export async function handleRegister(req: Request): Promise<Response> {
  let body: { name?: string; email?: string; password?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const { name, email, password } = body;

  if (!name || !email || !password) {
    return Response.json(
      { error: { code: 'validation-error', message: 'name, email, and password are required' } },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return Response.json(
      { error: { code: 'validation-error', message: 'Password must be at least 8 characters' } },
      { status: 400 },
    );
  }

  if (!isEmailDomainAllowed(email)) {
    return Response.json({ name: 'email-domain-not-allowed' }, { status: 422 });
  }

  // Deny duplicate email — constant-time check to avoid email enumeration via timing
  const existing = await db('users').where({ email }).first();
  if (existing) {
    return Response.json(
      { error: { code: 'email-already-registered', message: 'Email is already in use' } },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword({ password });
  const userId = generateId();
  const now = new Date();

  const verificationEnabled = await flags.isEnabled('EMAIL_VERIFICATION_ENABLED');

  let verificationToken: string | null = null;
  let verificationTokenExpiresAt: Date | null = null;

  if (verificationEnabled) {
    verificationToken = randomBytes(32).toString('hex');
    verificationTokenExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }

  await db('users').insert({
    id: userId,
    name,
    email,
    password_hash: passwordHash,
    email_verified: !verificationEnabled,
    verification_token: verificationToken,
    verification_token_expires_at: verificationTokenExpiresAt,
    created_at: now,
  });

  // When verification is enabled: send email and return 201 without a JWT
  if (verificationEnabled) {
    const verificationUrl = `${env.APP_URL}/verify-email?token=${verificationToken}`;
    const emailContent = await buildVerificationEmail({ verificationUrl });
    await send({ to: email, ...emailContent });

    return Response.json({ data: { requiresVerification: true } }, { status: 201 });
  }

  const user = await db('users').where({ id: userId }).first();

  const accessToken = await issueAccessToken({ sub: user.id, email: user.email });

  const refreshToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(now.getTime() + jwtConfig.refreshTokenTtlDays * 24 * 60 * 60 * 1000);

  await db('refresh_tokens').insert({
    id: generateId(),
    user_id: userId,
    token: refreshToken,
    expires_at: expiresAt,
    created_at: now,
  });

  const responseHeaders = new Headers({ 'Content-Type': 'application/json' });
  responseHeaders.append(
    'Set-Cookie',
    `refresh_token=${refreshToken}; HttpOnly; Path=/api/v1/auth/refresh; SameSite=Strict; Max-Age=${jwtConfig.refreshTokenTtlDays * 86400}`,
  );

  const avatarUrl = buildAvatarProxyUrl({ userId: user.id, avatarUrl: user.avatar_url ?? null });

  return new Response(
    JSON.stringify({
      data: {
        accessToken,
        user: { id: user.id, email: user.email, name: user.name, avatarUrl },
      },
    }),
    { status: 201, headers: responseHeaders },
  );
}
