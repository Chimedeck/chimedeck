// Generates a pre-signed S3 PUT URL so the client can upload directly to S3.
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, s3Config } from '../../common/config/s3';

const UPLOAD_URL_TTL_SECONDS = 5 * 60; // 5 minutes per spec

export async function presignPut({
  s3Key,
  mimeType,
  sizeBytes,
}: {
  s3Key: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: s3Config.bucket,
    Key: s3Key,
    ContentType: mimeType,
    ContentLength: sizeBytes,
  });

  return getSignedUrl(s3Client, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
}
