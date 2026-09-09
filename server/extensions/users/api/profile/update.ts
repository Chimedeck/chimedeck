// PATCH /api/v1/users/me — update nickname and/or display name.
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { buildAvatarProxyUrl } from '../../../../common/avatar/resolveAvatarUrl';

const NICKNAME_PATTERN = /^[a-zA-Z0-9_-]{1,50}$/;

// Matches the `users` table columns read/written here (migrations 0002, 0014, 0015).
type UserRow = {
  id: string;
  email: string;
  name: string;
  nickname: string | null;
  avatar_url: string | null;
  email_verified: boolean;
  created_at: string;
};

export async function handleUpdateProfile(req: Request): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const authenticatedReq = req as AuthenticatedRequest;
  const { currentUser } = authenticatedReq;
  if (!currentUser) {
    return Response.json(
      { error: { code: 'unauthorized', message: 'Missing authenticated user' } },
      { status: 401 },
    );
  }

  let body: { nickname?: string; name?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const updates: Record<string, string> = {};

  if (typeof body.name === 'string') {
    if (body.name.length < 1 || body.name.length > 100) {
      return Response.json(
        { error: { code: 'bad-request', message: 'Name must be between 1 and 100 characters' } },
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
      .whereNot({ id: currentUser.id })
      .first<Pick<UserRow, 'id'> | undefined>();

    if (existing) {
      return Response.json(
        { error: { code: 'nickname-taken', message: 'This nickname is already taken' } },
        { status: 409 },
      );
    }

    updates.nickname = body.nickname;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json(
      { error: { code: 'bad-request', message: 'Nothing to update' } },
      { status: 400 },
    );
  }

  const [user] = await db('users')
    .where({ id: currentUser.id })
    .update(updates)
    .returning<UserRow[]>('*');

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
      nickname: user.nickname ?? null,
      avatar_url: avatarUrl,
      email_verified: user.email_verified,
      created_at: user.created_at,
    },
  });
}
