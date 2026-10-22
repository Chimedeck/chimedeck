import { strict as assert } from 'node:assert';
import { mock } from 'bun:test';

// Shared DB mock stays in a child process, away from other suites' mock.module state.
type Row = Record<string, unknown>;

const boards: Row[] = [{ id: 'board-1', workspace_id: 'ws-1' }];
const memberships: Row[] = [{ user_id: 'user-1', workspace_id: 'ws-1', role: 'ADMIN' }];
let boardPlugins: Row[] = [
  {
    id: 'bp-1',
    board_id: 'board-1',
    plugin_id: 'plugin-1',
    enabled_by: 'user-1',
    enabled_at: new Date('2024-01-01T00:00:00.000Z'),
    disabled_at: null,
    config: {},
  },
];
const plugins: Row[] = [
  { id: 'plugin-1', whitelisted_domains: ['api.example.com', 'cdn.example.com'] },
  { id: 'plugin-no-domains', whitelisted_domains: null },
];

const updateCalls: Array<{ table: string; where: Row; payload: Row }> = [];

void mock.module('../../../../../../common/db', () => ({
  db(table: string) {
    return {
      where(criteria: Row) {
        const source =
          table === 'boards'
            ? boards
            : table === 'memberships'
              ? memberships
              : table === 'board_plugins'
                ? boardPlugins
                : table === 'plugins'
                  ? plugins
                  : [];
        const matches = (row: Row) =>
          Object.entries(criteria).every(([key, value]) => row[key] === value);
        return {
          whereNull(column: string) {
            const filtered = source.filter((row) => matches(row) && row[column] == null);
            return {
              first: <T>() => Promise.resolve(filtered[0] as T | undefined),
            };
          },
          first: <T>() => Promise.resolve(source.find(matches) as T | undefined),
          update(payload: Row) {
            updateCalls.push({ table, where: criteria, payload });
            boardPlugins = boardPlugins.map((row) =>
              matches(row) ? { ...row, ...payload } : row,
            );
            return Promise.resolve(1);
          },
        };
      },
    };
  },
}));

void mock.module('../../../../../auth/middlewares/authentication', () => ({
  authenticate(req: { currentUser?: { id: string; email: string } }) {
    req.currentUser = { id: 'user-1', email: 'admin@example.com' };
    return Promise.resolve(null);
  },
}));

const { handleSetBoardPluginAllowedDomains } = await import('../../allowed-domains');

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/v1/boards/board-1/plugins/plugin-1/allowed-domains', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

// ─── invalid JSON body ──────────────────────────────────────────────────────
{
  const req = new Request('http://localhost/x', { method: 'PATCH', body: '{not json' });
  const res = await handleSetBoardPluginAllowedDomains(req, 'board-1', 'plugin-1');
  assert.equal(res.status, 400);
  const json = (await res.json()) as { error: { code: string } };
  assert.equal(json.error.code, 'bad-request');
}

// ─── plugin not enabled on board (no active board_plugins row) ────────────
{
  const res = await handleSetBoardPluginAllowedDomains(
    makeRequest({ allowedDomains: ['api.example.com'] }),
    'board-1',
    'plugin-missing',
  );
  assert.equal(res.status, 404);
  const json = (await res.json()) as { error: { code: string } };
  assert.equal(json.error.code, 'plugin-not-enabled');
}

// ─── allowedDomains not an array ───────────────────────────────────────────
{
  const res = await handleSetBoardPluginAllowedDomains(
    makeRequest({ allowedDomains: 'not-an-array' }),
    'board-1',
    'plugin-1',
  );
  assert.equal(res.status, 422);
  const json = (await res.json()) as { error: { code: string } };
  assert.equal(json.error.code, 'invalid-allowed-domains');
}

// ─── domain not in plugin's whitelistedDomains ─────────────────────────────
{
  const res = await handleSetBoardPluginAllowedDomains(
    makeRequest({ allowedDomains: ['not-whitelisted.com'] }),
    'board-1',
    'plugin-1',
  );
  assert.equal(res.status, 422);
  const json = (await res.json()) as { name: string; data: { message: string } };
  assert.equal(json.name, 'domain-not-whitelisted-by-plugin');
  assert.equal(json.data.message, "'not-whitelisted.com' is not in the plugin's whitelistedDomains");
}

// ─── plugin has no whitelisted domains (null) — any non-null request rejected
{
  boardPlugins.push({
    id: 'bp-2',
    board_id: 'board-1',
    plugin_id: 'plugin-no-domains',
    enabled_by: 'user-1',
    enabled_at: new Date(),
    disabled_at: null,
    config: {},
  });
  const res = await handleSetBoardPluginAllowedDomains(
    makeRequest({ allowedDomains: ['anything.com'] }),
    'board-1',
    'plugin-no-domains',
  );
  assert.equal(res.status, 422);
  const json = (await res.json()) as { name: string };
  assert.equal(json.name, 'domain-not-whitelisted-by-plugin');
}

// ─── success: valid subset persists config and preserves existing keys ────
{
  updateCalls.length = 0;
  boardPlugins = boardPlugins.map((row) =>
    row.id === 'bp-1' ? { ...row, config: { unrelated: 'keep-me' } } : row,
  );
  const res = await handleSetBoardPluginAllowedDomains(
    makeRequest({ allowedDomains: ['api.example.com'] }),
    'board-1',
    'plugin-1',
  );
  assert.equal(res.status, 200);
  const json = (await res.json()) as {
    data: { boardPluginId: string; allowedDomains: string[] };
  };
  assert.equal(json.data.boardPluginId, 'bp-1');
  assert.deepEqual(json.data.allowedDomains, ['api.example.com']);

  assert.equal(updateCalls.length, 1);
  const [updateCall] = updateCalls;
  assert.ok(updateCall);
  assert.equal(updateCall.table, 'board_plugins');
  assert.deepEqual(updateCall.where, { id: 'bp-1' });
  const persistedConfig = JSON.parse(updateCall.payload.config as string) as Row;
  assert.equal(persistedConfig.unrelated, 'keep-me');
  assert.deepEqual(persistedConfig.allowedDomains, ['api.example.com']);
}

// ─── success: null allowedDomains clears restriction without domain checks ─
{
  updateCalls.length = 0;
  const res = await handleSetBoardPluginAllowedDomains(
    makeRequest({ allowedDomains: null }),
    'board-1',
    'plugin-1',
  );
  assert.equal(res.status, 200);
  const json = (await res.json()) as { data: { allowedDomains: string[] | null } };
  assert.equal(json.data.allowedDomains, null);
  assert.equal(updateCalls.length, 1);
}
