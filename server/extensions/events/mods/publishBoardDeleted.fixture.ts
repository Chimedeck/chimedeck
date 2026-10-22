import { strict as assert } from 'node:assert';
import { mock } from 'bun:test';

const calls: unknown[] = [];
let members: { user_id: string }[] = [];
let failing = '';
const failure = new Error('transport failed');
const event = { id: 'event-a', sequence: 42n, created_at: '2026-01-01T00:00:00Z' };
void mock.module('../../../common/db', () => ({
  db(table: string) {
    calls.push(table);
    return {
      where(filter: Record<string, string>) {
        calls.push(filter);
        return this;
      },
      select(column: string) {
        calls.push(column);
        return failing === 'db' ? Promise.reject(failure) : Promise.resolve(members);
      },
    };
  },
}));
void mock.module('../../../mods/events/write', () => ({
  writeEvent(input: unknown) {
    calls.push(['write', input]);
    return failing === 'write' ? Promise.reject(failure) : Promise.resolve(event);
  },
}));
void mock.module('../../../mods/pubsub/index', () => ({
  pubsub: {
    publish(channel: string, message: string) {
      calls.push(['pubsub', channel, JSON.parse(message) as unknown]);
      return failing === 'pubsub' ? Promise.reject(failure) : Promise.resolve();
    },
  },
}));
void mock.module('../../realtime/userChannel', () => ({
  publishToUser(userId: string, message: unknown) {
    calls.push(['user', userId, message]);
    return failing === 'user' ? Promise.reject(failure) : Promise.resolve();
  },
}));
const { publishBoardDeleted } = await import('./publishBoardDeleted');
const input = { boardId: 'deleted-board', workspaceId: 'workspace-a', actorId: 'actor-a' };
const originalNow = Date.now;
Date.now = () => 123;
const message = {
  type: 'board_deleted', entity_id: input.boardId, actor_id: input.actorId,
  payload: { boardId: input.boardId, workspaceId: input.workspaceId },
  version: 42, sequence: '42', timestamp: event.created_at, emittedAt: 123,
};
const prefix = [
  ['write', { type: 'board_deleted', boardId: null, entityId: input.boardId, actorId: input.actorId, payload: message.payload }],
  ['pubsub', 'workspace:workspace-a', message],
  'memberships', { workspace_id: input.workspaceId }, 'user_id',
];
try {
  for (const rows of [[], [{ user_id: 'user-a' }], [{ user_id: 'user-a' }, { user_id: 'user-b' }]]) {
    members = rows;
    calls.length = 0;
    assert.deepEqual(await publishBoardDeleted(input), { eventId: event.id });
    assert.deepEqual(calls, [...prefix, ...rows.map(row => ['user', row.user_id, message])]);
  }
  failing = 'pubsub';
  calls.length = 0;
  assert.deepEqual(await publishBoardDeleted(input), { eventId: event.id });
  assert.deepEqual(calls, [...prefix, ...members.map(row => ['user', row.user_id, message])]);
  for (const stage of ['write', 'db', 'user']) {
    failing = stage;
    calls.length = 0;
    await assert.rejects(publishBoardDeleted(input), failure);
    assert.deepEqual(calls, stage === 'write' ? prefix.slice(0, 1) : stage === 'db' ? prefix : [...prefix, ['user', 'user-a', message]]);
  }
} finally {
  Date.now = originalNow;
}
