// POST /api/v1/users/me/avatar — upload, resize, and store avatar in S3.
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { s3Client, s3Config } from '../../../attachment/common/config/s3';
import { env } from '../../../../config/env';
import { resizeAvatar, avatarExtension, isValidAvatarFile } from '../../../../mods/imageProcessor';
import { deleteObject } from '../../../attachment/mods/s3/deleteObject';

export async function handleUploadAvatar(req: Request): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const { currentUser } = req as AuthenticatedRequest;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json(
      { name: 'bad-request', data: { message: 'Expected multipart/form-data' } },
      { status: 400 },
    );
  }

  const file = formData.get('avatar');
  if (!(file instanceof File)) {
    return Response.json(
      { name: 'bad-request', data: { message: 'Missing avatar field' } },
      { status: 400 },
    );
  }

  const mimeType = file.type;
  const sizeBytes = file.size;

  if (!isValidAvatarFile({ mimeType, sizeBytes })) {
    return Response.json(
      {
        name: 'invalid-avatar-file',
        data: { message: 'File must be an image (JPEG, PNG, WebP, GIF) under 5 MB' },
      },
      { status: 400 },
    );
  }

  const rawBuffer = Buffer.from(await file.arrayBuffer());
  const resized = await resizeAvatar({ buffer: rawBuffer, mimeType });

  const ext = avatarExtension(mimeType);
  const s3Key = `avatars/${currentUser!.id}.${ext}`;

  // Delete old avatar from S3 if it exists (any extension variant)
  const existingUser = await db('users').where({ id: currentUser!.id }).first();
  if (existingUser?.avatar_url) {
    try {
      const oldKey = existingUser.avatar_url.split('/').slice(-2).join('/'); // avatars/<id>.<ext>
      await deleteObject({ s3Key: oldKey });
    } catch {
      // Non-fatal — old file may already be gone
    }
  }

  await s3Client.send(
    new PutObjectCommand({
      Bucket: s3Config.bucket,
      Key: s3Key,
      Body: resized,
      ContentType: mimeType === 'image/webp' ? 'image/webp' : 'image/jpeg',
    }),
  );

  // Build public URL — use S3_ENDPOINT if set (LocalStack), otherwise standard AWS URL
  const baseUrl = env.S3_ENDPOINT
    ? `${env.S3_ENDPOINT}/${s3Config.bucket}`
    : `https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com`;
  const avatarUrl = `${baseUrl}/${s3Key}`;

  const [user] = await db('users')
    .where({ id: currentUser!.id })
    .update({ avatar_url: avatarUrl })
    .returning('*');

  return Response.json({ data: { avatar_url: user.avatar_url } });
}
