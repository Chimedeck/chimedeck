// server/middlewares/requireVerified.ts
// Enforces email verification on private routes when EMAIL_VERIFICATION_ENABLED is true.
// Must be applied after authenticate middleware (req.currentUser must be populated).
import { db } from '../common/db';
import { flags } from '../mods/flags';
import type { AuthenticatedRequest } from '../extensions/auth/middlewares/authentication';

export async function requireVerified(req: AuthenticatedRequest): Promise<Response | null> {
  const verificationEnabled = await flags.isEnabled('EMAIL_VERIFICATION_ENABLED');
  if (!verificationEnabled) return null;

  const userId = req.currentUser?.id;
  if (!userId) {
    return Response.json(
      { error: { code: 'unauthorized', message: 'Authentication required' } },
      { status: 401 },
    );
  }

  const user = await db('users').where({ id: userId }).select('email_verified').first();
  if (!user?.email_verified) {
    return Response.json(
      { error: { code: 'email-not-verified', message: 'Please verify your email to continue.' } },
      { status: 403 },
    );
  }

  return null;
}
