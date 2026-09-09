// GET /api/v1/users/me — return current user's full profile including nickname.
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { buildAvatarProxyUrl } from '../../../../common/avatar/resolveAvatarUrl';

// Matches the `users` table columns read here (migrations 0002, 0014, 0015).
type UserRow = {
  id: string;
  email: string;
  name: string;
  nickname: string | null;
  avatar_url: string | null;
  email_verified: boolean;
  created_at: string;
};

export async function handleGetProfile(req: Request): Promise<Response> {
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

  const user = await db('users').where({ id: currentUser.id }).first<UserRow | undefined>();

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
