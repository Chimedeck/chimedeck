import { describe, expect, test } from 'bun:test';
import { getS3KeysForDeletion } from '../api/deleteKeys';

describe('getS3KeysForDeletion', () => {
  test('returns non-empty file and thumbnail keys only for file attachments', () => {
    expect(
      getS3KeysForDeletion({
        type: 'FILE',
        s3_key: 'attachments/file.pdf',
        thumbnail_key: 'attachments/file-thumb.webp',
      }),
    ).toEqual(['attachments/file.pdf', 'attachments/file-thumb.webp']);

    expect(getS3KeysForDeletion({ type: 'URL', s3_key: null, thumbnail_key: null })).toEqual([]);
  });
});
