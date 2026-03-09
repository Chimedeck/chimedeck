// S3-compatible storage client configuration.
// All values sourced from env via the central config module.
import { env } from '../../../../config/env';
import { S3Client, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

export const s3Config = {
  bucket: env.S3_BUCKET,
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT || undefined,
} as const;

// Resolve S3 credentials: S3_AWS_ACCESS_KEY_ID takes priority so LocalStack and real
// AWS SES can coexist in the same environment. Falls back to the global AWS credentials.
const s3AccessKeyId = env.S3_AWS_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID;
const s3SecretAccessKey = env.S3_AWS_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY;

// Singleton S3 client — re-used across all S3 operations.
export const s3Client = new S3Client({
  region: s3Config.region,
  endpoint: s3Config.endpoint,
  credentials: {
    accessKeyId: s3AccessKeyId,
    secretAccessKey: s3SecretAccessKey,
  },
  // Required when using path-style URLs with LocalStack or custom S3 endpoints
  forcePathStyle: !!s3Config.endpoint,
});

/**
 * Ensure the configured S3 bucket exists. When S3_ENDPOINT is set (LocalStack /
 * custom endpoint) the bucket may not have been provisioned yet, so we create it
 * automatically if the HeadBucket call returns a 404. Safe to call at startup.
 */
export async function ensureBucketExists(): Promise<void> {
  // Only auto-create when using a custom endpoint (LocalStack / MinIO).
  // Against real AWS the bucket must be pre-created to avoid accidental provisioning.
  if (!s3Config.endpoint) return;

  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: s3Config.bucket }));
  } catch (err: unknown) {
    const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    if (status === 404 || status === 301) {
      await s3Client.send(
        new CreateBucketCommand({
          Bucket: s3Config.bucket,
          // CreateBucketConfiguration is required for regions other than us-east-1
          ...(s3Config.region !== 'us-east-1' && {
            CreateBucketConfiguration: { LocationConstraint: s3Config.region as any },
          }),
        }),
      );
      console.info(`[s3] Created bucket '${s3Config.bucket}' on ${s3Config.endpoint}`);
    } else {
      // Re-throw unexpected errors (auth, DNS, etc.) so startup fails loudly
      throw err;
    }
  }
}
