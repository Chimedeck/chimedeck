// Extracts and verifies the Bearer token from Authorization header.
// Attaches the decoded user payload to request extensions for downstream handlers.
// Deny-first: returns 401 immediately on missing or invalid token.
import { verifyAccessToken } from '../mods/token/verify';

export interface AuthenticatedRequest extends Request {
  currentUser?: {
    id: string;
    email: string;
  };
}

// Returns null on success (populates req.currentUser), or an error Response on failure.
export async function authenticate(req: AuthenticatedRequest): Promise<Response | null> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return Response.json(
      { name: 'unauthorized', data: { message: 'Missing Bearer token' } },
      { status: 401 },
    );
  }

  const decoded = await verifyAccessToken({ token });
  if (!decoded) {
    return Response.json(
      { name: 'unauthorized', data: { message: 'Invalid or expired access token' } },
      { status: 401 },
    );
  }

  req.currentUser = { id: decoded.sub, email: decoded.email };
  return null;
}
