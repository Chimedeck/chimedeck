import { strict as assert } from 'node:assert';
import { mock } from 'bun:test';

const calls: unknown[] = [];
const state: { authError: Response | null; failure?: Error; rows: unknown[] } = {
  authError: null,
  rows: [],
};
void mock.module('../../../../../common/db', () => ({
  db(table: string) {
    calls.push(table);
    return {
      where(filter: Record<string, boolean>) {
        calls.push(filter);
        return this;
      },
      orderBy(column: string, direction: string) {
        calls.push([column, direction]);
        return this;
      },
      select(...columns: string[]) {
        calls.push(columns);
        return state.failure ? Promise.reject(state.failure) : Promise.resolve(state.rows);
      },
    };
  },
}));
void mock.module('../../../../auth/middlewares/authentication', () => ({
  authenticate(req: Request) {
    calls.push(req);
    return Promise.resolve(state.authError);
  },
}));
const { handleListWebhooks } = await import('../../list');
const req = new Request('http://localhost/api/v1/webhooks');
const query = [req, 'webhooks', { is_active: true }, ['created_at', 'desc'],
  ['id', 'label', 'endpoint_url', 'event_types', 'is_active', 'created_at']];

state.authError = new Response('denied', { status: 401 });
assert.equal(await handleListWebhooks(req), state.authError);
assert.deepEqual(calls, [req]);
state.authError = null;
calls.length = 0;
const empty = await handleListWebhooks(req);
assert.equal(empty.status, 200);
assert.deepEqual(await empty.json(), { data: [] });
assert.deepEqual(calls, query);

// JSONB is not schema-constrained to strings or arrays: preserve its value.
for (const eventTypes of [[], ['card.created'], { unexpected: true }, null, 42]) {
  calls.length = 0;
  state.rows = [{ id: 'hook-a', label: 'A', endpoint_url: 'https://example.com/a',
    event_types: eventTypes, is_active: true, created_at: new Date('2026-01-02T03:04:05Z'),
    signing_secret: 'must-not-leak', workspace_id: null, created_by: 'another-user' },
  { id: 'hook-b', label: 'B', endpoint_url: 'https://example.com/b',
    event_types: [], is_active: true, created_at: '2026-01-01T00:00:00.000Z' }];
  const response = await handleListWebhooks(req);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: [
    { id: 'hook-a', label: 'A', endpointUrl: 'https://example.com/a', eventTypes,
      isActive: true, createdAt: '2026-01-02T03:04:05.000Z' },
    { id: 'hook-b', label: 'B', endpointUrl: 'https://example.com/b', eventTypes: [],
      isActive: true, createdAt: '2026-01-01T00:00:00.000Z' },
  ] });
  assert.deepEqual(calls, query);
}
state.failure = new Error('webhook read failed');
await assert.rejects(handleListWebhooks(req), state.failure);
console.info('webhook list auth short-circuit, global query, projection, JSONB and rejection verified');
