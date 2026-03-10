// POST /api/v1/auth/resend-verification
// Requires a valid JWT (unverified users are allowed).
// Rate-limited to 3 requests per hour per user.
import { randomBytes } from 'crypto';
import { db } from '../../../common/db';
import { authenticate } from '../middlewares/authentication';
import type { AuthenticatedRequest } from '../middlewares/authentication';
import { flags } from '../../../mods/flags';
import { memCache } from '../../../mods/cache';
import { send } from '../../email';
import { buildVerificationEmail } from '../../email/templates/verificationEmail';
import { env } from '../../../config/env';

const RESEND_RATE_LIMIT = 3;
const RESEND_WINDOW_SECONDS = 3600; // 1 hour

export async function handleResendVerification(req: Request): Promise<Response> {
  const authReq = req as AuthenticatedRequest;
  const authError = await authenticate(authReq);
  if (authError) return authError;

  const userId = authReq.currentUser!.id;

  // Rate limit: 3 per hour per user
  const rlKey = `rl:resend-verification:${userId}`;
  const count = memCache.incr(rlKey, RESEND_WINDOW_SECONDS);
  if (count > RESEND_RATE_LIMIT) {
    return Response.json(
      { error: { code: 'rate-limit-exceeded', message: 'Too many resend requests. Try again in an hour.' } },
      { status: 429 },
    );
  }

  const user = await db('users').where({ id: userId }).first();
  if (!user) {
    return Response.json(
      { error: { code: 'user-not-found', message: 'User not found' } },
      { status: 404 },
    );
  }

  if (user.email_verified) {
    return Response.json(
      { error: { code: 'already-verified', message: 'Email is already verified' } },
      { status: 400 },
    );
  }

  const verificationEnabled = await flags.isEnabled('EMAIL_VERIFICATION_ENABLED');
  if (!verificationEnabled) {
    return Response.json(
      { error: { code: 'feature-disabled', message: 'Email verification is not enabled' } },
      { status: 400 },
    );
  }

  // Regenerate token
  const newToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db('users').where({ id: userId }).update({
    verification_token: newToken,
    verification_token_expires_at: expiresAt,
  });

  const verificationUrl = `${env.APP_URL}/verify-email?token=${newToken}`;
  const emailContent = buildVerificationEmail({ verificationUrl });

  await send({ to: user.email, ...emailContent });

  return Response.json({ data: { sent: true } }, { status: 200 });
}
