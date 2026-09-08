// Deletes an S3 object by key.
// Direct server-side operation — uses the internal endpoint client.
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3ServerClient, s3Config } from '../../common/config/s3';

export async function deleteObject({ s3Key }: { s3Key: string }): Promise<void> {
  await s3ServerClient.send(new DeleteObjectCommand({ Bucket: s3Config.bucket, Key: s3Key }));
}
