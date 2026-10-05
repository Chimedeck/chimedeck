// Checks that an S3 object exists without downloading it.
// Direct server-side operation — uses the internal endpoint client.
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { s3ServerClient, s3Config } from '../../common/config/s3';

export async function headObject({ s3Key }: { s3Key: string }): Promise<boolean> {
  try {
    await s3ServerClient.send(new HeadObjectCommand({ Bucket: s3Config.bucket, Key: s3Key }));
    return true;
  } catch (err: unknown) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw err;
  }
}
