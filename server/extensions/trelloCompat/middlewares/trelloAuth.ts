import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { TRELLO_UNAUTHORIZED } from '../common/errors';

export type TrelloAuthUser = {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string | null;
};

export function getTrelloAuthUser(req: Request): TrelloAuthUser | null {
  const user = (req as AuthenticatedRequest).currentUser as TrelloAuthUser | undefined;
  if (!user || typeof user.id !== 'string' || typeof user.email !== 'string') return null;
  return user;
}

export async function trelloAuth(req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  const tokenParam = url.searchParams.get('token');

  let authReq = req;
  if (tokenParam && !req.headers.get('authorization')) {
    const headers = new Headers(req.headers);
    headers.set('authorization', `Bearer ${tokenParam}`);
    authReq = new Request(req.url, { method: req.method, headers, body: req.body });
  }

  const authError = await authenticate(authReq as AuthenticatedRequest);
  if (authError) return TRELLO_UNAUTHORIZED();

  const user = (authReq as AuthenticatedRequest).currentUser as TrelloAuthUser | undefined;
  if (!user || typeof user.id !== 'string' || typeof user.email !== 'string') {
    return TRELLO_UNAUTHORIZED();
  }

  (req as AuthenticatedRequest).currentUser = (authReq as AuthenticatedRequest).currentUser!;
  return null;
}
