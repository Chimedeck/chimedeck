// POST /api/v1/admin/users — provision an external user account.
// Only accessible to authenticated users whose email domain is in ADMIN_EMAIL_DOMAINS.
import { generateId } from '../../../common/uuid';
import { db } from '../../../common/db';
import { hashPassword } from '../mods/password/hash';
import { authenticate } from '../middlewares/authentication';
import type { AuthenticatedRequest } from '../middlewares/authentication';
import { isAdminEmailDomain } from '../common/isAdminEmailDomain';
import { generatePassword } from '../common/generatePassword';
import { flags } from '../../../mods/flags';
import { send } from '../../email';
import { adminInviteEmail } from '../../email/templates/adminInvite';
import { env } from '../../../config/env';

// Basic email format check — not exhaustive, but covers obvious invalids.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Password must be at least 8 chars with at least one letter and one digit.
const hasLetter = (s: string) => /[a-zA-Z]/.test(s);
const hasDigit = (s: string) => /[0-9]/.test(s);

export async function handleAdminCreateUser(req: Request): Promise<Response> {
  const authReq = req as AuthenticatedRequest;
  const authError = await authenticate(authReq);
  if (authError) return authError;

  const callerEmail = authReq.currentUser!.email;
  if (!isAdminEmailDomain(callerEmail)) {
    return Response.json({ name: 'admin-access-required' }, { status: 403 });
  }

  let body: { email?: string; displayName?: string; password?: string; sendEmail?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'bad-request', data: { message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const { email, displayName, password: providedPassword, sendEmail } = body;

  if (!email || !EMAIL_RE.test(email)) {
    return Response.json({ name: 'invalid-email' }, { status: 422 });
  }

  if (!displayName || !displayName.trim()) {
    return Response.json({ name: 'display-name-required' }, { status: 422 });
  }

  if (providedPassword !== undefined) {
    const isWeak =
      providedPassword.length < 8 ||
      !hasLetter(providedPassword) ||
      !hasDigit(providedPassword);
    if (isWeak) {
      return Response.json({ name: 'password-too-weak' }, { status: 422 });
    }
  }

  const normalizedEmail = email.toLowerCase().trim();

  const existing = await db('users').where({ email: normalizedEmail }).first();
  if (existing) {
    return Response.json({ name: 'email-already-in-use' }, { status: 409 });
  }

  const plainPassword = providedPassword ?? generatePassword(16);
  const passwordHash = await hashPassword({ password: plainPassword });
  const userId = generateId();
  const now = new Date();

  await db('users').insert({
    id: userId,
    name: displayName.trim(),
    email: normalizedEmail,
    password_hash: passwordHash,
    email_verified: true,
    verification_token: null,
    verification_token_expires_at: null,
    created_at: now,
  });

  const sesEnabled = await flags.isEnabled('SES_ENABLED');
  const shouldSend =
    sendEmail === true && sesEnabled === true && env.ADMIN_INVITE_EMAIL_ENABLED === true;

  let emailSent = false;
  if (shouldSend) {
    const callerUser = await db('users').where({ id: authReq.currentUser!.id }).first();
    const inviterName = callerUser?.name ?? callerEmail;
    const loginUrl = `${env.APP_URL}/login`;

    const emailContent = adminInviteEmail({
      inviterName,
      newUserEmail: normalizedEmail,
      plainPassword,
      loginUrl,
    });

    await send({ to: normalizedEmail, ...emailContent });
    emailSent = true;
  }

  return Response.json(
    {
      data: {
        id: userId,
        email: normalizedEmail,
        displayName: displayName.trim(),
      },
      credentials: {
        email: normalizedEmail,
        plainPassword,
      },
      emailSent,
    },
    { status: 201 },
  );
}
