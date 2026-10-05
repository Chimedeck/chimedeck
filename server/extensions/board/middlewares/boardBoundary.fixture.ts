// Executed in a child process so Bun module mocks cannot leak into other suites.
// Real middleware, fake DB: no live PostgreSQL or route/auth-composition coverage.
import assert from 'node:assert/strict';
import { mock } from 'bun:test';
import type { BoardScopedRequest } from './requireBoardWritable';

const [mode, scenario] = process.argv.slice(2);
assert.ok(mode === 'read' || mode === 'write');
assert.ok(
  scenario === 'active' || scenario === 'archived' || scenario === 'missing' || scenario === 'error'
);
const board =
  scenario === 'missing'
    ? undefined
    : {
        id: 'board-1',
        workspace_id: 'workspace-1',
        title: 'Board',
        state: scenario === 'archived' ? 'ARCHIVED' : 'ACTIVE',
        created_at: null,
        description: 'Extra fields must survive attachment',
      };
const calls: unknown[] = [];
const failure = new Error('database unavailable');
await mock.module('../../../common/db', () => ({
  db: (table: string) => ({
    where(filter: unknown) {
      calls.push({ table, filter });
      return {
        first() {
          return scenario === 'error' ? Promise.reject(failure) : Promise.resolve(board);
        },
      };
    },
  }),
}));
const { requireBoardAccess } = await import('./requireBoardAccess');
const { requireBoardWritable } = await import('./requireBoardWritable');
const handler = mode === 'read' ? requireBoardAccess : requireBoardWritable;
const req: BoardScopedRequest = new Request('http://127.0.0.1/boards/board-1');
if (scenario === 'error') {
  await assert.rejects(handler(req, 'board-1'), (error: unknown) => error === failure);
  assert.equal(req.board, undefined);
} else {
  const response = await handler(req, 'board-1');
  if (scenario === 'missing') {
    assert.ok(response);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: { code: 'board-not-found', message: 'Board not found' },
    });
    assert.equal(req.board, undefined);
  } else if (mode === 'write' && scenario === 'archived') {
    assert.ok(response);
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      error: {
        code: 'board-is-archived',
        message: 'This board is archived and cannot be modified.',
      },
    });
    assert.equal(req.board, undefined);
  } else {
    assert.equal(response, null);
    assert.equal(req.board, board);
  }
}
assert.deepEqual(calls, [{ table: 'boards', filter: { id: 'board-1' } }]);
