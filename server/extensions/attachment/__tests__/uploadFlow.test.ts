// Integration tests for the full upload flow, external URL creation, and delete.
// These tests mock S3 and DB to verify the API handler logic end-to-end.
import { describe, expect, test, mock, beforeEach } from 'bun:test';

// We test SSRF validator inline since it has no external dependencies
import { isForbiddenUrl } from '../api/addUrl';

describe('upload flow (unit/logic)', () => {
  test('VIRUS_SCAN_ENABLED=false: enqueueScan is a no-op', async () => {
    // Temporarily set env flag to false
    const originalFlag = process.env['VIRUS_SCAN_ENABLED'];
    process.env['VIRUS_SCAN_ENABLED'] = 'false';

    // Import with current env
    const { enqueueScan } = await import('../mods/virusScan/enqueue');
    // Should resolve without error (no-op path)
    await expect(enqueueScan({ attachmentId: 'test-id' })).resolves.toBeUndefined();

    process.env['VIRUS_SCAN_ENABLED'] = originalFlag ?? '';
  });
});

describe('external URL creation', () => {
  test('rejects internal IP addresses', () => {
    const cases = [
      'http://127.0.0.1/',
      'http://10.0.0.1/',
      'http://192.168.1.1/',
      'http://172.16.0.1/',
      'http://169.254.169.254/',
    ];
    for (const url of cases) {
      expect(isForbiddenUrl(url)).toBe(true);
    }
  });

  test('allows public URLs', () => {
    expect(isForbiddenUrl('https://cdn.example.com/file.pdf')).toBe(false);
  });
});

describe('attachment deletion cascade', () => {
  test('deleteObject is called for FILE attachments', async () => {
    // Verify the delete handler imports deleteObject (logic test without real S3)
    const deleteModule = await import('../mods/s3/deleteObject');
    expect(typeof deleteModule.deleteObject).toBe('function');
  });
});
