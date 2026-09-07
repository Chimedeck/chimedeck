import { describe, expect, test } from 'bun:test';
import { hasUploadedS3Key } from '../api/uploadConfirmation';

describe('hasUploadedS3Key', () => {
  test('requires a non-empty S3 key before confirming an upload', () => {
    expect(hasUploadedS3Key('attachments/card/file.pdf')).toBe(true);
    expect(hasUploadedS3Key('')).toBe(false);
    expect(hasUploadedS3Key(null)).toBe(false);
  });
});
