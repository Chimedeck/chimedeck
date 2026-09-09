import { test, expect } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const fixture = fileURLToPath(new URL('./fixtures/pluginCspOrigins.ts', import.meta.url));

for (const scenario of ['origins', 'empty', 'failure']) {
  test(`getPluginCspOrigins preserves ${scenario} contract in an isolated process`, () => {
    const result = spawnSync(process.execPath, [fixture, scenario], { encoding: 'utf8' });
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });
}
