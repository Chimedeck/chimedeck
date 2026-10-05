import { strict as assert } from 'node:assert';
import { mock } from 'bun:test';

type Row = Record<string, unknown> | undefined;
const rows: { boards?: Row; cards?: Row; lists?: Row; comments?: Row } = {};
const calls: unknown[] = [];

void mock.module('../../../common/db', () => ({
  db(table: 'boards' | 'cards' | 'lists' | 'comments') {
    calls.push(['table', table]);
    return {
      where(condition: unknown) {
        calls.push(['where', condition]);
        return this;
      },
      first() {
        calls.push(['first']);
        return Promise.resolve(rows[table]);
      },
    };
  },
}));

const { requireBoardNotArchived, resolveBoardFromCard, resolveBoardFromComment } = await import(
  '../../archivedBoardGuard'
);

// requireBoardNotArchived: board not found
calls.length = 0;
rows.boards = undefined;
let response = await requireBoardNotArchived('board-missing');
assert.equal(response?.status, 404);
assert.deepEqual(await response.json(), {
  error: { code: 'board-not-found', message: 'Board not found' },
});
assert.deepEqual(calls, [
  ['table', 'boards'],
  ['where', { id: 'board-missing' }],
  ['first'],
]);

// requireBoardNotArchived: archived board
calls.length = 0;
rows.boards = { id: 'board-1', state: 'ARCHIVED' };
response = await requireBoardNotArchived('board-1');
assert.equal(response?.status, 403);
assert.deepEqual(await response.json(), {
  error: {
    code: 'board-is-archived',
    message: 'This board is archived and cannot be modified.',
  },
});

// requireBoardNotArchived: active board passes through
calls.length = 0;
rows.boards = { id: 'board-1', state: 'ACTIVE' };
assert.equal(await requireBoardNotArchived('board-1'), null);

// resolveBoardFromCard: card not found
calls.length = 0;
rows.cards = undefined;
let result = await resolveBoardFromCard('card-missing');
assert.ok('error' in result);
assert.equal(result.error.status, 404);
assert.deepEqual(await result.error.json(), {
  error: { code: 'card-not-found', message: 'Card not found' },
});
assert.deepEqual(calls, [
  ['table', 'cards'],
  ['where', { id: 'card-missing' }],
  ['first'],
]);

// resolveBoardFromCard: card's list missing
calls.length = 0;
rows.cards = { id: 'card-1', list_id: 'list-missing' };
rows.lists = undefined;
result = await resolveBoardFromCard('card-1');
assert.ok('error' in result);
assert.equal(result.error.status, 404);
assert.deepEqual(await result.error.json(), {
  error: { code: 'card-not-found', message: 'Card parent list not found' },
});

// resolveBoardFromCard: list's board missing
calls.length = 0;
rows.cards = { id: 'card-1', list_id: 'list-1' };
rows.lists = { id: 'list-1', board_id: 'board-missing' };
rows.boards = undefined;
result = await resolveBoardFromCard('card-1');
assert.ok('error' in result);
assert.equal(result.error.status, 404);
assert.deepEqual(await result.error.json(), {
  error: { code: 'board-not-found', message: 'Board not found' },
});

// resolveBoardFromCard: archived board propagates 403
calls.length = 0;
rows.cards = { id: 'card-1', list_id: 'list-1' };
rows.lists = { id: 'list-1', board_id: 'board-1' };
rows.boards = { id: 'board-1', state: 'ARCHIVED' };
result = await resolveBoardFromCard('card-1');
assert.ok('error' in result);
assert.equal(result.error.status, 403);
assert.deepEqual(await result.error.json(), {
  error: {
    code: 'board-is-archived',
    message: 'This board is archived and cannot be modified.',
  },
});
assert.deepEqual(calls, [
  ['table', 'cards'],
  ['where', { id: 'card-1' }],
  ['first'],
  ['table', 'lists'],
  ['where', { id: 'list-1' }],
  ['first'],
  ['table', 'boards'],
  ['where', { id: 'board-1' }],
  ['first'],
]);

// resolveBoardFromCard: active board resolves { board }
calls.length = 0;
rows.boards = { id: 'board-1', state: 'ACTIVE' };
result = await resolveBoardFromCard('card-1');
assert.ok('board' in result);
assert.deepEqual(result.board, { id: 'board-1', state: 'ACTIVE' });

// resolveBoardFromComment: comment not found
calls.length = 0;
rows.comments = undefined;
result = await resolveBoardFromComment('comment-missing');
assert.ok('error' in result);
assert.equal(result.error.status, 404);
assert.deepEqual(await result.error.json(), {
  error: { code: 'comment-not-found', message: 'Comment not found' },
});
assert.deepEqual(calls, [
  ['table', 'comments'],
  ['where', { id: 'comment-missing' }],
  ['first'],
]);

// resolveBoardFromComment: delegates to resolveBoardFromCard with the comment's card_id
calls.length = 0;
rows.comments = { id: 'comment-1', card_id: 'card-1' };
rows.cards = { id: 'card-1', list_id: 'list-1' };
rows.lists = { id: 'list-1', board_id: 'board-1' };
rows.boards = { id: 'board-1', state: 'ACTIVE' };
result = await resolveBoardFromComment('comment-1');
assert.ok('board' in result);
assert.deepEqual(result.board, { id: 'board-1', state: 'ACTIVE' });
assert.deepEqual(calls, [
  ['table', 'comments'],
  ['where', { id: 'comment-1' }],
  ['first'],
  ['table', 'cards'],
  ['where', { id: 'card-1' }],
  ['first'],
  ['table', 'lists'],
  ['where', { id: 'list-1' }],
  ['first'],
  ['table', 'boards'],
  ['where', { id: 'board-1' }],
  ['first'],
]);
