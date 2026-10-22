import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const fixture = fileURLToPath(new URL('./thumbnail.fixture.ts', import.meta.url));

// Keep shared DB/S3/sharp mocks out of the suite; import the real handler in
// each isolated child process so adjacent tests cannot leak their mocks in.
test.each([
  'missing-attachment',
  'unsupported-mime',
  'null-mime',
  'missing-s3-key',
  'gif',
  'ready',
])('generateThumbnail: %s', (scenario) => {
  const result = spawnSync(process.execPath, [fixture, scenario], { encoding: 'utf8' });
  expect(result.error).toBeUndefined();
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
});
