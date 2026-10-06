import { expect, test } from 'bun:test';

test('board deletion publisher preserves workspace fanout and failure contracts', () => {
  const result = Bun.spawnSync([process.execPath, `${import.meta.dir}/publishBoardDeleted.fixture.ts`], {
    stdout: 'pipe', stderr: 'pipe',
  });
  expect(result.stderr.toString()).toBe('');
  expect(result.exitCode).toBe(0);
});
