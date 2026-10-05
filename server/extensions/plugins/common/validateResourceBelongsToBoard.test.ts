import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const fixture = fileURLToPath(new URL('./validateResourceBelongsToBoard.fixture.ts', import.meta.url));

// Subprocesses prevent shared DB mock leakage and adjacent tests replacing the guard.
// Query assertions do not establish live PostgreSQL filtering or route/auth wiring.
test.each([
  'board-match', 'board-mismatch', 'member-match',
  'list-match', 'list-missing', 'list-error',
  'card-match', 'card-missing', 'card-error',
])('plugin resource board boundary: %s', (scenario) => {
  const result = spawnSync(process.execPath, [fixture, scenario], { encoding: 'utf8' });
  expect(result.error).toBeUndefined();
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
});
