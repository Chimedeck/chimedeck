// Checks that an S3 object exists without downloading it.
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, s3Config } from '../../common/config/s3';

export async function headObject({ s3Key }: { s3Key: string }): Promise<boolean> {
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: s3Config.bucket, Key: s3Key }));
    return true;
  } catch (err: any) {
    if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw err;
  }
}
