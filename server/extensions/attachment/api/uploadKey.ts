export function buildUploadS3Key(cardId: string, attachmentId: string, filename: string): string {
  return `attachments/${cardId}/${attachmentId}/${filename}`;
}
