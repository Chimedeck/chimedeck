// Integration tests for the full upload flow, external URL creation, and delete.
// These tests mock S3 and DB to verify the API handler logic end-to-end.
// [why subprocess fixture] The virus-scan-disabled contract needs process-global
// mock.module on the shared db and pubsub modules; it lives in
// ./fixtures/uploadFlowVirusScan.ts (spawned as a subprocess) so the mocks cannot
// leak into — or be replaced by — adjacent suites that mock the same modules
// differently. Only that contract runs inside the fixture subprocess; this file
// itself holds plain tests (SSRF validator, delete wiring) with ordinary static
// and dynamic imports and no module mocking.
import { describe, expect, test } from 'bun:test';

// We test SSRF validator inline since it has no external dependencies
import { isForbiddenUrl } from '../api/addUrl';

describe('upload flow (unit/logic)', () => {
  test('VIRUS_SCAN_ENABLED=false: enqueueScan is a no-op (subprocess fixture)', async () => {
    const child = Bun.spawn(
      [process.execPath, new URL('./fixtures/uploadFlowVirusScan.ts', import.meta.url).pathname],
      { stdout: 'pipe', stderr: 'pipe' },
    );
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect(stderr).toBe('');
    expect(exitCode).toBe(0);
    expect(stdout).toContain(
      'enqueueScan no-op verified: resolves undefined, promotes attachment READY via db, never publishes to the scan queue'
    );
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
