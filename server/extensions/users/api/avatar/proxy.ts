// GET /api/v1/users/:id/avatar
// Secure proxy endpoint: authenticates the caller, then 302-redirects to a
// fresh short-lived (60 s) presigned S3 URL for the user's avatar.
// Never exposes the presigned URL unless the caller is authenticated.
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { db } from '../../../../common/db';
import {
  extractS3KeyFromAvatarUrl,
} from '../../../../common/avatar/resolveAvatarUrl';
import { presignGetUrl } from '../../../attachment/common/presign';

const PROXY_TTL_SECONDS = 60;

// db/migrations/0002_auth.ts: primary string ID and nullable avatar URL.
interface AvatarUserRow {
  id: string;
  avatar_url: string | null;
}

export async function handleAvatarProxy(req: Request, userId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const user = await db<AvatarUserRow>('users').where({ id: userId }).select('id', 'avatar_url').first();
  if (!user) {
    return Response.json(
      { name: 'user-not-found', data: { message: 'User not found' } },
      { status: 404 },
    );
  }

  if (!user.avatar_url) {
    return Response.json(
      { name: 'avatar-not-set', data: { message: 'User has no avatar' } },
      { status: 404 },
    );
  }

  const s3Key = extractS3KeyFromAvatarUrl({ avatarUrl: user.avatar_url });

  if (!s3Key) {
    // External avatar URL (e.g. GitHub OAuth) — proxy as a direct redirect
    return Response.redirect(user.avatar_url, 302);
  }

  const { url } = await presignGetUrl({ s3Key, ttlSeconds: PROXY_TTL_SECONDS });

  // 302 redirect to fresh short-lived presigned URL; token is never surfaced in the response body.
  return Response.redirect(url, 302);
}
