// POST /api/v1/auth/forgot-password
// Public endpoint — always returns 200 to prevent user enumeration.
// When an account exists, generates a reset token and sends a reset email.
import { randomBytes } from 'crypto';
import { db } from '../../../common/db';
import { memCache } from '../../../mods/cache';
import { send } from '../../email';
import { buildPasswordResetEmail } from '../../email/templates/passwordResetEmail';
import { env } from '../../../config/env';

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 3600; // 1 hour

export async function handleForgotPassword(req: Request): Promise<Response> {
  // Rate limit by IP: 5 requests per hour
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? 'unknown';
  const rlKey = `rl:forgot-password:${ip}`;
  const count = memCache.incr(rlKey, RATE_LIMIT_WINDOW_SECONDS);
  if (count > RATE_LIMIT_MAX) {
    // Still return 200 to avoid enumeration, but do nothing further
    return Response.json({ data: { sent: true } }, { status: 200 });
  }

  let body: { email?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (!body.email) {
    return Response.json(
      { error: { code: 'bad-request', message: 'email is required' } },
      { status: 400 },
    );
  }

  const email = body.email.toLowerCase().trim();

  // Always return success — look up user silently
  const user = await db('users').where({ email }).first();
  if (user) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db('users').where({ id: user.id }).update({
      password_reset_token: token,
      password_reset_token_expires_at: expiresAt,
    });

    const resetUrl = `${env.APP_URL}/reset-password?token=${token}`;
    const emailContent = await buildPasswordResetEmail({ resetUrl, expiresIn: '1 hour' });
    await send({ to: email, ...emailContent });
  }

  return Response.json({ data: { sent: true } }, { status: 200 });
}
