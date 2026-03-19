// DELETE /api/v1/users/me/avatar — remove avatar from S3 and clear DB field.
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { deleteObject } from '../../../attachment/mods/s3/deleteObject';
import { extractS3KeyFromAvatarUrl } from '../../../../common/avatar/resolveAvatarUrl';

export async function handleRemoveAvatar(req: Request): Promise<Response> {
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

  if (user.avatar_url) {
    try {
      const s3Key = extractS3KeyFromAvatarUrl({ avatarUrl: user.avatar_url });
      if (s3Key) {
        await deleteObject({ s3Key });
      }
    } catch {
      // Non-fatal — continue to clear DB even if S3 delete fails
    }
  }

  await db('users').where({ id: currentUser!.id }).update({ avatar_url: null });

  return new Response(null, { status: 204 });
}
