// GET /api/v1/users/me — return current user.
// PATCH /api/v1/users/me — update name / avatar_url.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';

export async function handleGetMe(req: Request): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const { currentUser } = req as AuthenticatedRequest;
  const user = await db('users').where({ id: currentUser!.id }).first();

  if (!user) {
    return Response.json(
      { name: 'user-not-found', data: { message: 'User not found' } },
      { status: 404 },
    );
  }

  return Response.json({
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
    },
  });
}

export async function handlePatchMe(req: Request): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const { currentUser } = req as AuthenticatedRequest;

  let body: { name?: string; avatar_url?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'bad-request', data: { message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const updates: Record<string, string> = {};
  if (typeof body.name === 'string') updates.name = body.name;
  if (typeof body.avatar_url === 'string') updates.avatar_url = body.avatar_url;

  if (Object.keys(updates).length === 0) {
    return Response.json(
      { name: 'bad-request', data: { message: 'Nothing to update' } },
      { status: 400 },
    );
  }

  const [user] = await db('users').where({ id: currentUser!.id }).update(updates).returning('*');

  if (!user) {
    return Response.json(
      { name: 'user-not-found', data: { message: 'User not found' } },
      { status: 404 },
    );
  }

  return Response.json({
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
    },
  });
}
