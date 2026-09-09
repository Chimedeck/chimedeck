import { mock } from 'bun:test';
import assert from 'node:assert/strict';

const scenario = process.argv[2] ?? '';

const attachmentBase = { id: 'attachment-a', card_id: 'card-a' };

const dbCalls: { table: string; filter: unknown; update?: unknown }[] = [];
const s3Calls: { command: string; input: unknown }[] = [];

function attachmentFor(scenarioName: string): Record<string, unknown> | undefined {
  if (scenarioName === 'missing-attachment') return undefined;
  if (scenarioName === 'unsupported-mime') return { ...attachmentBase, mime_type: 'application/pdf', s3_key: 'k' };
  if (scenarioName === 'null-mime') return { ...attachmentBase, mime_type: null, s3_key: 'k' };
  if (scenarioName === 'missing-s3-key') return { ...attachmentBase, mime_type: 'image/png', s3_key: null };
  if (scenarioName === 'gif') return { ...attachmentBase, mime_type: 'image/gif', s3_key: 'k' };
  return { ...attachmentBase, mime_type: 'image/png', s3_key: 'k' };
}

void mock.module('../../../../common/db', () => ({
  db: (table: string) =>
    ({
      where: (filter: unknown) => ({
        first: () => {
          dbCalls.push({ table, filter, update: undefined });
          return Promise.resolve(attachmentFor(scenario));
        },
        update: (patch: unknown) => {
          dbCalls.push({ table, filter, update: patch });
          return Promise.resolve(1);
        },
      }),
    }) as unknown,
}));

void mock.module('../../common/config/s3', () => ({
  s3ServerClient: {
    send: (command: { constructor: { name: string }; input: unknown }) => {
      s3Calls.push({ command: command.constructor.name, input: command.input });
      if (command.constructor.name === 'GetObjectCommand') {
        return Promise.resolve({
          Body: (function* () {
            yield new Uint8Array([1, 2, 3]);
          })(),
        });
      }
      return Promise.resolve({});
    },
  },
  s3Config: { bucket: 'test-bucket' },
}));

void mock.module('sharp', () => ({
  default: () => ({
    metadata: () => Promise.resolve({ width: 200, height: 100 }),
    resize: () => ({
      webp: () => ({
        toBuffer: () => Promise.resolve(Buffer.from('webp-bytes')),
      }),
    }),
  }),
}));

const { generateThumbnail } = await import('../thumbnail');

await generateThumbnail({ attachmentId: 'attachment-a' });

const updateCall = dbCalls.find((c) => c.table === 'attachments' && c.update !== undefined);

if (scenario === 'missing-attachment') {
  assert.equal(updateCall, undefined);
  assert.equal(s3Calls.length, 0);
} else if (scenario === 'unsupported-mime' || scenario === 'null-mime') {
  assert.equal(updateCall, undefined);
  assert.equal(s3Calls.length, 0);
} else if (scenario === 'missing-s3-key') {
  assert.equal(updateCall, undefined);
  assert.equal(s3Calls.length, 0);
} else if (scenario === 'gif') {
  assert.equal(s3Calls.filter((c) => c.command === 'PutObjectCommand').length, 0);
  assert.deepEqual(updateCall?.update, { width: 200, height: 100 });
} else {
  assert.equal(scenario, 'ready');
  assert.equal(s3Calls.filter((c) => c.command === 'GetObjectCommand').length, 1);
  assert.equal(s3Calls.filter((c) => c.command === 'PutObjectCommand').length, 1);
  assert.deepEqual(updateCall?.update, {
    thumbnail_key: 'thumbnails/card-a/attachment-a.webp',
    width: 200,
    height: 100,
  });
}
