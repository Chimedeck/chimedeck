import { mock } from 'bun:test';
import assert from 'node:assert/strict';
import type { CardScopedRequest } from './requireCardWritable';

const scenario = process.argv[2];
const card = {
  id: 'card-a', list_id: 'list-a', title: 'Card', description: null,
  position: 'a', archived: scenario === 'card-archived' || scenario === 'both-archived',
  due_date: null, created_at: null, updated_at: new Date('2026-01-01'),
  extra_column: 'preserved',
};
const list = { id: 'list-a', board_id: 'board-a', archived: true };
const board = {
  id: 'board-a', workspace_id: 'workspace-a', title: 'Board',
  state: scenario === 'board-archived' || scenario === 'both-archived' ? 'ARCHIVED' : 'ACTIVE',
  created_at: null, extra_column: 'preserved',
};
const calls: { table: string; filter: unknown }[] = [];
const failure = new Error('database unavailable');
void mock.module('../../../common/db', () => ({
  db: (table: string) => ({
    where: (filter: unknown) => ({
      first: () => {
        calls.push({ table, filter });
        if (scenario === `error-${table}`) return Promise.reject(failure);
        const rows: Record<string, unknown> = { cards: card, lists: list, boards: board };
        return Promise.resolve(scenario === `missing-${table}` ? undefined : rows[table]);
      },
    }),
  }),
}));
const { requireCardWritable } = await import('./requireCardWritable');
const req: CardScopedRequest = new Request('http://127.0.0.1/cards/card-a');
if (scenario?.startsWith('error-')) {
  await assert.rejects(requireCardWritable(req, 'card-a'), (error: unknown) => error === failure);
} else {
  const response = await requireCardWritable(req, 'card-a');
  const errors: Record<string, [number, string, string]> = {
    'missing-cards': [404, 'card-not-found', 'Card not found'],
    'missing-lists': [404, 'card-not-found', 'Card parent list not found'],
    'missing-boards': [404, 'board-not-found', 'Board not found'],
    'board-archived': [403, 'board-is-archived', 'This board is archived and cannot be modified.'],
    'both-archived': [403, 'board-is-archived', 'This board is archived and cannot be modified.'],
    'card-archived': [403, 'card-archived', 'Card is archived and cannot be modified'],
  };
  const expected = errors[scenario ?? ''];
  if (expected) {
    assert.ok(response);
    assert.equal(response.status, expected[0]);
    assert.deepEqual(await response.json(), { error: { code: expected[1], message: expected[2] } });
  } else {
    assert.equal(scenario, 'active');
    assert.equal(response, null);
    assert.equal(req.card, card);
    assert.equal(req.board, board);
  }
}
const count = scenario?.endsWith('-cards') ? 1 : scenario?.endsWith('-lists') ? 2 : 3;
assert.deepEqual(calls, [
  { table: 'cards', filter: { id: 'card-a' } },
  { table: 'lists', filter: { id: 'list-a' } },
  { table: 'boards', filter: { id: 'board-a' } },
].slice(0, count));
if (scenario !== 'active') {
  assert.equal(req.card, undefined);
  assert.equal(req.board, undefined);
}
