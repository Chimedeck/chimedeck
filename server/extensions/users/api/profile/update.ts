// PATCH /api/v1/users/me — update nickname and/or display name.
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';

const NICKNAME_PATTERN = /^[a-zA-Z0-9_-]{1,50}$/;

export async function handleUpdateProfile(req: Request): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const { currentUser } = req as AuthenticatedRequest;

  let body: { nickname?: string; name?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'bad-request', data: { message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const updates: Record<string, string> = {};

  if (typeof body.name === 'string') {
    if (body.name.length < 1 || body.name.length > 100) {
      return Response.json(
        { name: 'bad-request', data: { message: 'Name must be between 1 and 100 characters' } },
        { status: 400 },
      );
    }
    updates.name = body.name;
  }

  if (typeof body.nickname === 'string') {
    if (!NICKNAME_PATTERN.test(body.nickname)) {
      return Response.json(
        {
          name: 'bad-request',
          data: { message: 'Nickname must be 1–50 alphanumeric characters, underscores, or hyphens' },
        },
        { status: 400 },
      );
    }

    // Check uniqueness — exclude the current user
    const existing = await db('users')
      .where({ nickname: body.nickname })
      .whereNot({ id: currentUser!.id })
      .first();

    if (existing) {
      return Response.json(
        { name: 'nickname-taken', data: { message: 'This nickname is already taken' } },
        { status: 409 },
      );
    }

    updates.nickname = body.nickname;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json(
      { name: 'bad-request', data: { message: 'Nothing to update' } },
      { status: 400 },
    );
  }

  const [user] = await db('users')
    .where({ id: currentUser!.id })
    .update(updates)
    .returning('*');

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
      nickname: user.nickname ?? null,
      avatar_url: user.avatar_url ?? null,
      email_verified: user.email_verified ?? false,
      created_at: user.created_at,
    },
  });
}
