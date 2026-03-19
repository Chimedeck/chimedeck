// Thumbnail worker: generates a 400×300 max WebP thumbnail for image attachments.
// Called after virus scan marks an attachment as READY.
// Stores the thumbnail at thumbnails/<card_id>/<attachment_id>.webp in S3
// and updates thumbnail_key, width, height columns in the DB.
import sharp from 'sharp';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, s3Config } from '../common/config/s3';
import { db } from '../../../common/db';

const THUMBNAIL_MAX_WIDTH = 400;
const THUMBNAIL_MAX_HEIGHT = 300;

// SVG excluded — sharp requires explicit rasterization density per file.
const THUMBNAIL_SUPPORTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

export async function generateThumbnail({ attachmentId }: { attachmentId: string }): Promise<void> {
  const attachment = await db('attachments').where({ id: attachmentId }).first();
  if (!attachment) return;

  // Use mime_type (client-provided on upload) to gate image-only processing
  const mimeType: string | null = attachment.mime_type ?? null;
  if (!mimeType || !THUMBNAIL_SUPPORTED_TYPES.has(mimeType)) return;

  if (!attachment.s3_key) return;

  // Download original file from S3
  const getResult = await s3Client.send(
    new GetObjectCommand({ Bucket: s3Config.bucket, Key: attachment.s3_key }),
  );

  const chunks: Uint8Array[] = [];
  for await (const chunk of getResult.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);

  // Read source dimensions before resizing so we can persist them
  const image = sharp(buffer);
  const metadata = await image.metadata();

  const resized = await image
    .resize(THUMBNAIL_MAX_WIDTH, THUMBNAIL_MAX_HEIGHT, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 80 })
    .toBuffer();

  const thumbnailKey = `thumbnails/${attachment.card_id}/${attachmentId}.webp`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: s3Config.bucket,
      Key: thumbnailKey,
      Body: resized,
      ContentType: 'image/webp',
    }),
  );

  await db('attachments').where({ id: attachmentId }).update({
    thumbnail_key: thumbnailKey,
    width: metadata.width ?? null,
    height: metadata.height ?? null,
  });
}
