// POST /api/v1/auth/change-email
// Authenticated users may request an email change.
// When EMAIL_VERIFICATION_ENABLED=true a confirmation link is emailed to the new address.
// When false the change is applied immediately.
import { randomBytes } from 'crypto';
import { db } from '../../../common/db';
import { authenticate } from '../middlewares/authentication';
import type { AuthenticatedRequest } from '../middlewares/authentication';
import { verifyPassword } from '../mods/password/verify';
import { flags } from '../../../mods/flags';
import { memCache } from '../../../mods/cache';
import { send } from '../../email';
import { buildEmailChangeConfirmation } from '../../email/templates/emailChangeConfirmation';
import { env } from '../../../config/env';
import { isEmailDomainAllowed } from '../common/emailDomain';

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_SECONDS = 3600; // 1 hour

export async function handleChangeEmail(req: Request): Promise<Response> {
  const authReq = req as AuthenticatedRequest;
  const authError = await authenticate(authReq);
  if (authError) return authError;

  const userId = authReq.currentUser!.id;

  // Rate limit: 3 per hour per user
  const rlKey = `rl:change-email:${userId}`;
  const count = memCache.incr(rlKey, RATE_LIMIT_WINDOW_SECONDS);
  if (count > RATE_LIMIT_MAX) {
    return Response.json(
      { name: 'rate-limit-exceeded', data: { message: 'Too many email change requests. Try again in an hour.' } },
      { status: 429 },
    );
  }

  let body: { email?: string; currentPassword?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'bad-request', data: { message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (!body.email || !body.currentPassword) {
    return Response.json(
      { name: 'bad-request', data: { message: 'email and currentPassword are required' } },
      { status: 400 },
    );
  }

  const newEmail = body.email.toLowerCase().trim();

  const user = await db('users').where({ id: userId }).first();
  if (!user) {
    return Response.json(
      { name: 'user-not-found', data: { message: 'User not found' } },
      { status: 404 },
    );
  }

  // Re-validate current password before any change
  const valid = await verifyPassword({ password: body.currentPassword, hash: user.password_hash });
  if (!valid) {
    return Response.json(
      { name: 'credentials-invalid', data: { message: 'Current password is incorrect' } },
      { status: 401 },
    );
  }

  if (newEmail === user.email.toLowerCase().trim()) {
    return Response.json(
      { name: 'email-unchanged', data: { message: 'New email must be different from current email' } },
      { status: 422 },
    );
  }

  if (!isEmailDomainAllowed(newEmail)) {
    return Response.json({ name: 'email-domain-not-allowed' }, { status: 422 });
  }

  // Check whether the new email is already taken
  const existing = await db('users').where({ email: newEmail }).whereNot({ id: userId }).first();
  if (existing) {
    return Response.json(
      { name: 'email-already-in-use', data: { message: 'That email address is already in use' } },
      { status: 409 },
    );
  }

  const verificationEnabled = await flags.isEnabled('EMAIL_VERIFICATION_ENABLED');

  if (!verificationEnabled) {
    // Apply immediately
    await db('users').where({ id: userId }).update({
      email: newEmail,
      pending_email: null,
      email_change_token: null,
      email_change_token_expires_at: null,
    });
    // Invalidate all refresh tokens so re-login is required
    await db('refresh_tokens').where({ user_id: userId }).delete();
    return Response.json({ data: { email: newEmail } }, { status: 200 });
  }

  // Confirmation flow: store token + pending email, send email
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db('users').where({ id: userId }).update({
    pending_email: newEmail,
    email_change_token: token,
    email_change_token_expires_at: expiresAt,
  });

  const confirmUrl = `${env.APP_URL}/confirm-email-change?token=${token}`;
  const emailContent = buildEmailChangeConfirmation({ newEmail, confirmUrl, expiresIn: '24 hours' });
  await send({ to: newEmail, ...emailContent });

  return Response.json(
    { data: { requiresConfirmation: true, pendingEmail: newEmail } },
    { status: 200 },
  );
}
