// S3-compatible storage client configuration.
// All values sourced from env via the central config module.
import { env } from '../../../../config/env';
import { S3Client } from '@aws-sdk/client-s3';

export const s3Config = {
  bucket: env.S3_BUCKET,
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT || undefined,
} as const;

// Singleton S3 client — re-used across all S3 operations.
export const s3Client = new S3Client({
  region: s3Config.region,
  endpoint: s3Config.endpoint,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
  // Required when using path-style URLs with LocalStack or custom S3 endpoints
  forcePathStyle: !!s3Config.endpoint,
});
