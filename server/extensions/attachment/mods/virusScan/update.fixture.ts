import { mock } from 'bun:test';
import assert from 'node:assert/strict';

const scenario = process.argv[2];

const attachment = { id: 'attachment-a', card_id: 'card-a', uploaded_by: 'user-a' };
const card = { id: 'card-a', list_id: 'list-a' };
const list = { id: 'list-a', board_id: 'board-a' };
const board = { id: 'board-a' };

const calls: { table: string; filter: unknown; update?: unknown }[] = [];
const thumbnailCalls: unknown[] = [];
const writeEventCalls: unknown[] = [];
const publishCalls: { boardId: string; message: string }[] = [];

void mock.module('../../../../common/db', () => ({
  db: (table: string) =>
    ({
      where: (filter: unknown) => ({
        first: () => {
          calls.push({ table, filter, update: undefined });
          if (scenario === `missing-${table}`) return Promise.resolve(undefined);
          const rows: Record<string, unknown> = { attachments: attachment, cards: card, lists: list, boards: board };
          return Promise.resolve(rows[table]);
        },
        update: (patch: unknown) => {
          calls.push({ table, filter, update: patch });
          return Promise.resolve(1);
        },
      }),
    }) as unknown,
}));

void mock.module('../../workers/thumbnail', () => ({
  generateThumbnail: (input: unknown) => {
    thumbnailCalls.push(input);
    if (scenario === 'thumbnail-rejects') return Promise.reject(new Error('thumbnail boom'));
    return Promise.resolve();
  },
}));

void mock.module('../../../../mods/events/write', () => ({
  writeEvent: (input: unknown) => {
    writeEventCalls.push(input);
    return Promise.resolve({});
  },
}));

void mock.module('../../../../mods/pubsub/publisher', () => ({
  publisher: {
    publish: (boardId: string, message: string) => {
      publishCalls.push({ boardId, message });
      return Promise.resolve();
    },
  },
}));

const { updateScanResult } = await import('./update');

await updateScanResult({
  attachmentId: 'attachment-a',
  status: scenario === 'rejected' ? 'REJECTED' : 'READY',
});

// Small delay to let the fire-and-forget thumbnail promise settle.
await new Promise((resolve) => setTimeout(resolve, 10));

if (scenario === 'missing-attachments') {
  assert.deepEqual(calls, [{ table: 'attachments', filter: { id: 'attachment-a' }, update: undefined }]);
  assert.equal(thumbnailCalls.length, 0);
  assert.equal(writeEventCalls.length, 0);
  assert.equal(publishCalls.length, 0);
} else if (scenario === 'missing-cards') {
  assert.equal(thumbnailCalls.length, 1);
  assert.equal(writeEventCalls.length, 0);
  assert.equal(publishCalls.length, 0);
} else if (scenario === 'missing-lists' || scenario === 'missing-boards') {
  assert.equal(thumbnailCalls.length, 1);
  assert.equal(writeEventCalls.length, 0);
  assert.equal(publishCalls.length, 0);
} else if (scenario === 'rejected') {
  assert.equal(thumbnailCalls.length, 0);
  assert.equal(writeEventCalls.length, 1);
  assert.equal(publishCalls.length, 1);
  assert.deepEqual(writeEventCalls[0], {
    type: 'attachment_updated',
    boardId: 'board-a',
    entityId: 'card-a',
    actorId: 'user-a',
    payload: { attachmentId: 'attachment-a', status: 'REJECTED' },
  });
} else if (scenario === 'thumbnail-rejects') {
  // Thumbnail failure is fire-and-forget and must not block event/publish.
  assert.equal(thumbnailCalls.length, 1);
  assert.equal(writeEventCalls.length, 1);
  assert.equal(publishCalls.length, 1);
} else {
  assert.equal(scenario, 'ready');
  assert.equal(thumbnailCalls.length, 1);
  assert.deepEqual(thumbnailCalls[0], { attachmentId: 'attachment-a' });
  assert.equal(writeEventCalls.length, 1);
  assert.deepEqual(writeEventCalls[0], {
    type: 'attachment_updated',
    boardId: 'board-a',
    entityId: 'card-a',
    actorId: 'user-a',
    payload: { attachmentId: 'attachment-a', status: 'READY' },
  });
  assert.equal(publishCalls.length, 1);
  const publishCall = publishCalls[0];
  assert.ok(publishCall);
  assert.equal(publishCall.boardId, 'board-a');
  assert.deepEqual(JSON.parse(publishCall.message), {
    type: 'attachment_updated',
    entity_id: 'card-a',
    payload: { attachmentId: 'attachment-a', status: 'READY' },
  });
}

const statusUpdateCall = calls.find((c) => c.table === 'attachments' && c.update !== undefined);
if (scenario === 'missing-attachments') {
  assert.equal(statusUpdateCall, undefined);
} else {
  assert.deepEqual(statusUpdateCall?.update, { status: scenario === 'rejected' ? 'REJECTED' : 'READY' });
}
