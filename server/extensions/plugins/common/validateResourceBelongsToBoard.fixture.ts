import { mock } from 'bun:test';
import assert from 'node:assert/strict';

const scenario = process.argv[2];
assert.ok(scenario);
const [scope, outcome] = scenario.split('-');
assert.ok(scope === 'board' || scope === 'member' || scope === 'list' || scope === 'card');
const resourceId = scope === 'board' && outcome === 'match' ? 'board-a' : 'resource-a';
const boardId = 'board-a';
const calls: unknown[][] = [];
const failure = new Error('database unavailable');
// Only the DB transport is fake; every scenario imports the real guard in a child process.
void mock.module('../../../common/db', () => ({
  db: (table: string) => {
    calls.push(['db', table]);
    const query = {
      join: (...args: unknown[]) => { calls.push(['join', ...args]); return query; },
      where: (...args: unknown[]) => { calls.push(['where', ...args]); return query; },
      select: (...args: unknown[]) => { calls.push(['select', ...args]); return query; },
      first: () => {
        calls.push(['first']);
        if (outcome === 'error') return Promise.reject(failure);
        return Promise.resolve(outcome === 'missing' ? undefined : { id: resourceId });
      },
    };
    return query;
  },
}));
const { validateResourceBelongsToBoard, ResourceBoardMismatchError } =
  await import('./validateResourceBelongsToBoard');
const result = validateResourceBelongsToBoard(scope, resourceId, boardId);
if (outcome === 'error') {
  await assert.rejects(result, (error: unknown) => error === failure);
} else if (outcome === 'missing' || outcome === 'mismatch') {
  await assert.rejects(result, (error: unknown) => {
    assert.ok(error instanceof ResourceBoardMismatchError);
    assert.equal(error.name, 'resource-board-mismatch');
    assert.equal(error.message, `${scope} '${resourceId}' does not belong to board '${boardId}'`);
    assert.equal(error.scope, scope);
    assert.equal(error.resourceId, resourceId);
    assert.equal(error.boardId, boardId);
    return true;
  });
} else {
  await result;
}
assert.deepEqual(calls, scope === 'list' ? [
  ['db', 'lists'], ['where', { id: resourceId, board_id: boardId }], ['first'],
] : scope === 'card' ? [
  ['db', 'cards'], ['join', 'lists', 'cards.list_id', 'lists.id'],
  ['where', 'cards.id', resourceId], ['where', 'lists.board_id', boardId],
  ['select', 'cards.id'], ['first'],
] : []);
