// GET /api/v1/health-check/presets — returns the pre-configured service list.
// Auth: authenticated user only (no board membership required).
// No credentials or private info are exposed — all URLs are public.
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import presetsJson from '../../../config/health-check-services.json';

export async function handleGetPresets(req: Request): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  return Response.json({ data: presetsJson });
}
