// Middleware that ensures the authenticated user is a platform admin.
// Checks the caller's email against the PLATFORM_ADMIN_EMAILS list.
// Deny-first: returns 403 if the email is absent or not in the list.
import { authenticate, type AuthenticatedRequest } from '../extensions/auth/middlewares/authentication';
import { isPlatformAdmin } from '../config/platformAdmin';

// Returns null on success, or an error Response if the caller is not a platform admin.
export async function platformAdminGuard(req: AuthenticatedRequest): Promise<Response | null> {
  const authError = await authenticate(req);
  if (authError) return authError;

  const email = req.currentUser?.email;
  if (!email || !isPlatformAdmin(email)) {
    return Response.json(
      { name: 'not-platform-admin', data: { message: 'Platform admin access required' } },
      { status: 403 },
    );
  }

  return null;
}
