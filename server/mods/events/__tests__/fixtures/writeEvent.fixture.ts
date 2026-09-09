import { strict as assert } from 'node:assert';
import { mock } from 'bun:test';

// Shared DB mock stays in a child process, away from other suites' mock.module state.
const calls: unknown[] = [];
let insertedRow: Record<string, unknown> | undefined;

void mock.module('../../../../common/db', () => ({
  db(table: string) {
    calls.push(['table', table]);
    return {
      insert(payload: Record<string, unknown>, returning: string[]) {
        calls.push(['insert', payload, returning]);
        return Promise.resolve(insertedRow === undefined ? [] : [insertedRow]);
      },
    };
  },
}));

const snapshotCalls: unknown[] = [];
void mock.module('../../snapshot/policy', () => ({
  checkAndWriteSnapshot(args: unknown) {
    snapshotCalls.push(args);
    return Promise.resolve();
  },
}));

const publishCalls: unknown[] = [];
void mock.module('../../../pubsub/publisher', () => ({
  publisher: {
    publish(boardId: string, message: string) {
      publishCalls.push([boardId, message]);
      return Promise.resolve();
    },
  },
}));

const { writeEvent } = await import('../../write');

// Throws when the insert returns no row (defensive guard; should never happen
// against a real DB, but proves the function fails closed rather than
// returning an unsafely-cast undefined event).
calls.length = 0;
insertedRow = undefined;
await assert.rejects(
  () =>
    writeEvent({
      type: 'card.created',
      boardId: 'board-1',
      entityId: 'card-1',
      actorId: 'user-1',
      payload: { foo: 'bar' },
    }),
  /Failed to write event row/,
);

// boardId present: builds the insert payload, awaits checkAndWriteSnapshot
// and publisher.publish as best-effort (their promises are not awaited by
// writeEvent itself, so we poll briefly), and returns the hydrated row.
calls.length = 0;
snapshotCalls.length = 0;
publishCalls.length = 0;
const createdAt = new Date('2024-01-01T00:00:00.000Z');
insertedRow = {
  id: 'event-1',
  type: 'card.created',
  board_id: 'board-1',
  entity_id: 'card-1',
  actor_id: 'user-1',
  payload: { foo: 'bar' },
  sequence: 42n,
  created_at: createdAt,
};

const result = await writeEvent({
  type: 'card.created',
  boardId: 'board-1',
  entityId: 'card-1',
  actorId: 'user-1',
  payload: { foo: 'bar' },
});

assert.deepEqual(result, insertedRow);
assert.equal(calls.length, 2);
const [tableCall, insertCall] = calls as [
  ['table', string],
  ['insert', Record<string, unknown>, string[]],
];
assert.deepEqual(tableCall, ['table', 'events']);
assert.equal(insertCall[0], 'insert');
assert.equal(insertCall[2][0], '*');
const insertPayload = insertCall[1];
assert.equal(typeof insertPayload.id, 'string');
assert.equal(insertPayload.type, 'card.created');
assert.equal(insertPayload.board_id, 'board-1');
assert.equal(insertPayload.entity_id, 'card-1');
assert.equal(insertPayload.actor_id, 'user-1');
assert.equal(insertPayload.payload, JSON.stringify({ foo: 'bar' }));
assert.equal(typeof insertPayload.created_at, 'string');

// give the fire-and-forget snapshot/publish promises a tick to resolve
await new Promise((resolve) => setTimeout(resolve, 10));
assert.deepEqual(snapshotCalls, [{ boardId: 'board-1', sequence: 42n }]);
assert.equal(publishCalls.length, 1);
const [publishBoardId, publishMessageRaw] = publishCalls[0] as [string, string];
assert.equal(publishBoardId, 'board-1');
const publishMessage = JSON.parse(publishMessageRaw) as Record<string, unknown>;
assert.equal(publishMessage.type, 'card.created');
assert.equal(publishMessage.entity_id, 'card-1');
assert.equal(publishMessage.actor_id, 'user-1');
assert.deepEqual(publishMessage.payload, { foo: 'bar' });
assert.equal(publishMessage.version, 42);
assert.equal(publishMessage.sequence, '42');
assert.equal(publishMessage.timestamp, createdAt.toISOString());
assert.equal(typeof publishMessage.emittedAt, 'number');

// boardId absent: no snapshot/publish side effects, insert still runs with
// board_id null.
calls.length = 0;
snapshotCalls.length = 0;
publishCalls.length = 0;
insertedRow = {
  id: 'event-2',
  type: 'workspace.renamed',
  board_id: null,
  entity_id: 'workspace-1',
  actor_id: 'user-1',
  payload: {},
  sequence: 43n,
  created_at: createdAt,
};

const noBoardResult = await writeEvent({
  type: 'workspace.renamed',
  entityId: 'workspace-1',
  actorId: 'user-1',
  payload: {},
});

assert.deepEqual(noBoardResult, insertedRow);
const [, noBoardInsertCall] = calls as [
  ['table', string],
  ['insert', Record<string, unknown>, string[]],
];
assert.equal(noBoardInsertCall[1].board_id, null);

await new Promise((resolve) => setTimeout(resolve, 10));
assert.deepEqual(snapshotCalls, []);
assert.deepEqual(publishCalls, []);
