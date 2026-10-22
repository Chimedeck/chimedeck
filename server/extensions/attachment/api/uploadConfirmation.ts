export function hasUploadedS3Key(s3Key: string | null): s3Key is string {
  return typeof s3Key === 'string' && s3Key.length > 0;
}
