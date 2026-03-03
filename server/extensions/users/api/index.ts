// Mounts all user routes under /api/v1/users.
import { handleGetProfile } from './profile/get';
import { handleUpdateProfile } from './profile/update';
import { handleUploadAvatar } from './avatar/upload';
import { handleRemoveAvatar } from './avatar/remove';

// Returns a Response if the path matches a users route, otherwise null.
export async function usersRouter(req: Request, pathname: string): Promise<Response | null> {
  if (pathname === '/api/v1/users/me') {
    if (req.method === 'GET') return handleGetProfile(req);
    if (req.method === 'PATCH') return handleUpdateProfile(req);
  }

  if (pathname === '/api/v1/users/me/avatar') {
    if (req.method === 'POST') return handleUploadAvatar(req);
    if (req.method === 'DELETE') return handleRemoveAvatar(req);
  }

  return null;
}
