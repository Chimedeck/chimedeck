// Mounts all user routes under /api/v1/users.
import { handleGetMe, handlePatchMe } from './me';

// Returns a Response if the path matches a users route, otherwise null.
export async function usersRouter(req: Request, pathname: string): Promise<Response | null> {
  if (pathname === '/api/v1/users/me') {
    if (req.method === 'GET') return handleGetMe(req);
    if (req.method === 'PATCH') return handlePatchMe(req);
  }

  return null;
}
