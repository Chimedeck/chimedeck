// API Token router — mounts POST, GET, DELETE for /api/v1/tokens.
import { handleCreateToken } from './create';
import { handleListTokens } from './list';
import { handleRevokeToken } from './revoke';

export async function apiTokenRouter(req: Request, pathname: string): Promise<Response | null> {
  // POST /api/v1/tokens — create token
  if (pathname === '/api/v1/tokens' && req.method === 'POST') {
    return handleCreateToken(req);
  }

  // GET /api/v1/tokens — list tokens
  if (pathname === '/api/v1/tokens' && req.method === 'GET') {
    return handleListTokens(req);
  }

  // DELETE /api/v1/tokens/:id — revoke token
  const revokeMatch = pathname.match(/^\/api\/v1\/tokens\/([^/]+)$/);
  if (revokeMatch && req.method === 'DELETE') {
    return handleRevokeToken(req, revokeMatch[1] as string);
  }

  return null;
}
