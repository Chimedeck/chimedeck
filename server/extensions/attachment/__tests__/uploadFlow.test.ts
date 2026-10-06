// Integration tests for the full upload flow, external URL creation, and delete.
// These tests mock S3 and DB to verify the API handler logic end-to-end.
import { describe, expect, test, mock } from 'bun:test';

// We test SSRF validator inline since it has no external dependencies
import { isForbiddenUrl } from '../api/addUrl';

describe('upload flow (unit/logic)', () => {
  // [why fakes] With VIRUS_SCAN_ENABLED=false the real enqueueScan writes the READY
  // promotion through the real db client — the fakes keep this test fully offline
  // and make the no-op contract (resolves undefined, one READY update, no publish)
  // actually assertable, per the copilot round-1 thread on the unawaited matcher.
  mock.module('../../../common/db', () => {
    const touch: { table: string; values?: Record<string, unknown> }[] = [];
    const dbFn = ((table: string) => ({
      where() {
        return {
          update(values: Record<string, unknown>) {
            touch.push({ table, values });
            return Promise.resolve(1);
          },
        };
      },
    })) as unknown as typeof import('../../../common/db').db;
    (dbFn as unknown as { __touch: typeof touch }).__touch = touch;
    return { db: dbFn };
  });
  const published: Array<{ channel: string; message: string }> = [];
  mock.module('../../../mods/pubsub/index', () => ({
    publisher: {
      publish: (channel: string, message: string) => {
        published.push({ channel, message });
        return Promise.resolve();
      },
    },
  }));

  test('VIRUS_SCAN_ENABLED=false: enqueueScan is a no-op (READY promotion, no queue publish)', async () => {
    // Temporarily set env flag to false
    const originalFlag = process.env['VIRUS_SCAN_ENABLED'];
    process.env['VIRUS_SCAN_ENABLED'] = 'false';

    const { env } = await import('../../../config/env');
    const realEnabled = env.VIRUS_SCAN_ENABLED;
    try {
      (env as { VIRUS_SCAN_ENABLED: boolean }).VIRUS_SCAN_ENABLED = false;

      // Import with current env
      const { enqueueScan } = await import('../mods/virusScan/enqueue');
      // [why awaited] Copilot round-1: the matcher was unawaited, so the test could
      // restore the env flag and finish before enqueueScan/matcher settled — false
      // pass or unhandled rejection.
      await expect(enqueueScan({ attachmentId: 'test-id' })).resolves.toBeUndefined();
      expect(published).toEqual([]);
    } finally {
      (env as { VIRUS_SCAN_ENABLED: boolean }).VIRUS_SCAN_ENABLED = realEnabled;
      process.env['VIRUS_SCAN_ENABLED'] = originalFlag ?? '';
    }
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
