export interface AttachmentStorageKeys {
  type: 'FILE' | 'URL';
  s3_key: string | null;
  thumbnail_key: string | null;
}

export function getS3KeysForDeletion(attachment: AttachmentStorageKeys): string[] {
  if (attachment.type !== 'FILE') return [];

  return [attachment.s3_key, attachment.thumbnail_key].filter(
    (key): key is string => typeof key === 'string' && key.length > 0,
  );
}
