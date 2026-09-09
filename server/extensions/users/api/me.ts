// GET /api/v1/users/me — return current user.
// PATCH /api/v1/users/me — update name / avatar_url.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { buildAvatarProxyUrl } from '../../../common/avatar/resolveAvatarUrl';

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
};

export async function handleGetMe(req: Request): Promise<Response> {
  const authenticatedReq = req as AuthenticatedRequest;
  const authError = await authenticate(authenticatedReq);
  if (authError) return authError;

  const { currentUser } = authenticatedReq;
  if (!currentUser) return Response.json({ error: { code: 'unauthorized', message: 'Missing authenticated user' } }, { status: 401 });
  const user = (await db('users').where({ id: currentUser.id }).first()) as UserRow | undefined;

  if (!user) {
    return Response.json(
      { error: { code: 'user-not-found', message: 'User not found' } },
      { status: 404 },
    );
  }

  const avatarUrl = buildAvatarProxyUrl({ userId: user.id, avatarUrl: user.avatar_url ?? null });

  return Response.json({
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: avatarUrl,
      created_at: user.created_at,
    },
  });
}

export async function handlePatchMe(req: Request): Promise<Response> {
  const authenticatedReq = req as AuthenticatedRequest;
  const authError = await authenticate(authenticatedReq);
  if (authError) return authError;

  const { currentUser } = authenticatedReq;
  if (!currentUser) return Response.json({ error: { code: 'unauthorized', message: 'Missing authenticated user' } }, { status: 401 });

  let body: { name?: string; avatar_url?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const updates: Record<string, string> = {};
  if (typeof body.name === 'string') updates.name = body.name;
  if (typeof body.avatar_url === 'string') updates.avatar_url = body.avatar_url;

  if (Object.keys(updates).length === 0) {
    return Response.json(
      { error: { code: 'bad-request', message: 'Nothing to update' } },
      { status: 400 },
    );
  }

  const users = (await db('users')
    .where({ id: currentUser.id })
    .update(updates)
    .returning('*')) as UserRow[];
  const [user] = users;

  if (!user) {
    return Response.json(
      { error: { code: 'user-not-found', message: 'User not found' } },
      { status: 404 },
    );
  }

  const avatarUrl = buildAvatarProxyUrl({ userId: user.id, avatarUrl: user.avatar_url ?? null });

  return Response.json({
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: avatarUrl,
      created_at: user.created_at,
    },
  });
}
