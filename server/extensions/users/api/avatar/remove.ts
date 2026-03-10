// DELETE /api/v1/users/me/avatar — remove avatar from S3 and clear DB field.
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { deleteObject } from '../../../attachment/mods/s3/deleteObject';

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
      // Extract the S3 key from the URL path — last two segments: avatars/<id>.<ext>
      const url = new URL(user.avatar_url);
      const s3Key = url.pathname.replace(/^\/[^/]+\//, ''); // strip leading /<bucket>/
      await deleteObject({ s3Key });
    } catch {
      // Non-fatal — continue to clear DB even if S3 delete fails
    }
  }

  await db('users').where({ id: currentUser!.id }).update({ avatar_url: null });

  return new Response(null, { status: 204 });
}
