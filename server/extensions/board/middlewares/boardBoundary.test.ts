import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const fixture = fileURLToPath(new URL('./boardBoundary.fixture.ts', import.meta.url));

// Child isolation protects both the real middleware imports and other suites' DB mocks.
for (const mode of ['read', 'write']) {
  test.each(['active', 'archived', 'missing', 'error'])(
    `${mode} board boundary: %s`,
    (scenario) => {
      const result = spawnSync(process.execPath, [fixture, mode, scenario], { encoding: 'utf8' });
      expect(result.error).toBeUndefined();
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
    }
  );
}
