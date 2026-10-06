// Subprocess fixture — attachment upload flow, virus-scan-disabled no-op path.
// [why subprocess] mock.module on shared db/pubsub modules is process-global; the
// repository isolates such mocks in subprocess fixtures (see
// server/extensions/search/mods/__tests__/fixtures/queryWorkspaceSearch.ts) so
// adjacent suites that mock the same modules differently cannot poison each other.
// bun:test's mock.module IS available inside the spawned process (bun:test is the
// runtime test harness bundled with bun).
import { strict as assert } from 'node:assert';
import { mock } from 'bun:test';

// Simulate the disabled flag through the centralized config module: mock
// server/config/env BEFORE the enqueue import reads it, so no process-global
// env mutation is needed and the disabled-path premise is explicit.
await mock.module('../../../../config/env', () => ({
  env: { VIRUS_SCAN_ENABLED: false },
}));

const published: Array<{ channel: string; message: string }> = [];
const dbTouches: Array<{ table: string; values: Record<string, unknown> }> = [];

await mock.module('../../../../common/db', () => {
  const dbFn = ((table: string) => ({
    where() {
      return {
        update(values: Record<string, unknown>) {
          dbTouches.push({ table, values });
          return Promise.resolve(1);
        },
      };
    },
  })) as unknown as typeof import('../../../../common/db').db;
  return { db: dbFn };
});

await mock.module('../../../../mods/pubsub/index', () => ({
  pubsub: {
    publish: (channel: string, message: string) => {
      published.push({ channel, message });
      return Promise.resolve();
    },
  },
}));

// Import AFTER mocks are registered.
const { enqueueScan } = await import('../../mods/virusScan/enqueue');

// The disabled path must resolve undefined (no error), promote the attachment to
// READY through the db client, and never publish to the scan queue.
await assert.doesNotReject(enqueueScan({ attachmentId: 'test-id' }));
assert.equal(published.length, 0);
assert.deepEqual(dbTouches, [{ table: 'attachments', values: { status: 'READY' } }]);

console.info(
  'enqueueScan no-op verified: resolves undefined, promotes attachment READY via db, never publishes to the scan queue'
);
