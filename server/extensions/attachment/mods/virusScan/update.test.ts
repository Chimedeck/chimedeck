import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const fixture = fileURLToPath(new URL('./update.fixture.ts', import.meta.url));

// Keep shared DB/thumbnail/event/publisher mocks out of the suite; import the
// real handler in each isolated child process.
test.each([
  'ready',
  'rejected',
  'missing-attachments',
  'missing-cards',
  'missing-lists',
  'missing-boards',
])('updateScanResult: %s', (scenario) => {
  const result = spawnSync(process.execPath, [fixture, scenario], { encoding: 'utf8' });
  expect(result.error).toBeUndefined();
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
});

// Thumbnail generation is fire-and-forget; a rejection is caught and logged
// to stderr rather than propagating, so this scenario asserts on that log
// instead of an empty stderr.
test('updateScanResult: thumbnail-rejects logs and does not block event/publish', () => {
  const result = spawnSync(process.execPath, [fixture, 'thumbnail-rejects'], { encoding: 'utf8' });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(result.stderr).toContain('[thumbnail] failed for attachment-a');
});
