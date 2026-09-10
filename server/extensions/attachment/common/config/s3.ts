// S3-compatible storage client configuration.
// All values sourced from env via the central config module.
import { env } from '../../../../config/env';
import { S3Client, CreateBucketCommand, HeadBucketCommand, type BucketLocationConstraint } from '@aws-sdk/client-s3';

export const s3Config = {
  bucket: env.S3_BUCKET,
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT || undefined,
} as const;

// Resolve S3 credentials: S3_AWS_ACCESS_KEY_ID takes priority so LocalStack and real
// AWS SES can coexist in the same environment. Falls back to the global AWS credentials.
const s3AccessKeyId = env.S3_AWS_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID;
const s3SecretAccessKey = env.S3_AWS_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY;

/**
 * Endpoint for direct server-side S3 operations. Falls back to the public
 * S3_ENDPOINT when S3_INTERNAL_ENDPOINT is not configured.
 *
 * S3_ENDPOINT may sit behind a public proxy. Presigned URLs MUST target that
 * public endpoint so browsers can reach them, but server-side object operations
 * (Head/Delete/Get/Put, bucket management, multipart control calls) must go
 * direct — routing them through the proxy causes races where a just-written
 * object reads back as 403/Unknown.
 */
const internalEndpoint = env.S3_INTERNAL_ENDPOINT || env.S3_ENDPOINT || undefined;

// Shared client options — both clients use the same credentials/region.
const clientOptions = {
  region: s3Config.region,
  credentials: {
    accessKeyId: s3AccessKeyId,
    secretAccessKey: s3SecretAccessKey,
  },
};

// Public-facing S3 client — used ONLY to generate presigned URLs handed to the
// browser (presigned PUT, presigned GET helpers/redirects, multipart part URLs).
// The signature covers the public endpoint host, so it cannot be swapped for the
// internal one.
export const s3Client = new S3Client({
  ...clientOptions,
  ...(s3Config.endpoint ? { endpoint: s3Config.endpoint } : {}),
  // Required when using path-style URLs with LocalStack or custom S3 endpoints
  forcePathStyle: !!s3Config.endpoint,
});

// Server-side S3 client — used for ALL direct object operations from the server
// (ensureBucketExists, headObject, deleteObject, proxyS3Object, thumbnail Get/Put,
// multipart create/complete/abort, avatar Put, board-background Put).
export const s3ServerClient = new S3Client({
  ...clientOptions,
  ...(internalEndpoint ? { endpoint: internalEndpoint } : {}),
  // Required when using path-style URLs with LocalStack or custom S3 endpoints
  forcePathStyle: !!internalEndpoint,
});

/**
 * Ensure the configured S3 bucket exists. When a custom endpoint is set
 * (LocalStack or a self-hosted object store) the bucket may not have been provisioned yet, so we
 * create it automatically if the HeadBucket call returns a 404. Safe to call
 * at startup. Always checks via the internal endpoint — this is a direct
 * server operation.
 */
export async function ensureBucketExists(): Promise<void> {
  // Only auto-create when using a custom endpoint (LocalStack or a self-hosted object store).
  // Against real AWS the bucket must be pre-created to avoid accidental provisioning.
  if (!internalEndpoint) return;

  try {
    await s3ServerClient.send(new HeadBucketCommand({ Bucket: s3Config.bucket }));
  } catch (err: unknown) {
    const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    if (status === 404 || status === 301) {
      await s3ServerClient.send(
        new CreateBucketCommand({
          Bucket: s3Config.bucket,
          // CreateBucketConfiguration is required for regions other than us-east-1
          ...(s3Config.region !== 'us-east-1' && {
            CreateBucketConfiguration: { LocationConstraint: s3Config.region as BucketLocationConstraint },
          }),
        })
      );
      console.info(`[s3] Created bucket '${s3Config.bucket}' on ${internalEndpoint}`);
    } else {
      // Re-throw unexpected errors (auth, DNS, etc.) so startup fails loudly
      throw err;
    }
  }
}
