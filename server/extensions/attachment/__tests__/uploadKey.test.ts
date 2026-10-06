import { describe, expect, test } from 'bun:test';
import { buildUploadS3Key } from '../api/uploadKey';

describe('buildUploadS3Key', () => {
  test('keeps generated uploads within their card and attachment namespace', () => {
    expect(buildUploadS3Key('card-123', 'attachment-456', 'report.pdf')).toBe(
      'attachments/card-123/attachment-456/report.pdf',
    );
  });
});
