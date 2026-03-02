// Generates a pre-signed S3 GET URL so authenticated callers can download files.
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, s3Config } from '../../common/config/s3';

const READ_URL_TTL_SECONDS = 15 * 60; // 15 minutes per spec

export async function presignGet({ s3Key }: { s3Key: string }): Promise<{ url: string; expiresAt: string }> {
  const command = new GetObjectCommand({
    Bucket: s3Config.bucket,
    Key: s3Key,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn: READ_URL_TTL_SECONDS });
  const expiresAt = new Date(Date.now() + READ_URL_TTL_SECONDS * 1000).toISOString();

  return { url, expiresAt };
}
