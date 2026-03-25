// GET /api/v1/users/me — return current user's full profile including nickname.
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { buildAvatarProxyUrl } from '../../../../common/avatar/resolveAvatarUrl';

export async function handleGetProfile(req: Request): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const { currentUser } = req as AuthenticatedRequest;
  const user = await db('users').where({ id: currentUser!.id }).first();

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
      email_verified: user.email_verified ?? false,
      created_at: user.created_at,
    },
  });
}
