import { mock } from 'bun:test';
import assert from 'node:assert/strict';

const scenario = process.argv[2];
const rows = [
  { connector_url: 'https://plugin.example/path?q=1', whitelisted_domains: ['https://api.example/a', 'https://api.example/b', 'http://localhost:8080/path', 'invalid', 'data:text/plain,hello'] },
  { connector_url: 'https://plugin.example/other', whitelisted_domains: null },
  { connector_url: null, whitelisted_domains: { url: 'https://ignored.example' } },
  { connector_url: 'not a URL', whitelisted_domains: '["https://ignored.example"]' },
  { connector_url: 'data:text/plain,hello', whitelisted_domains: [] },
  { connector_url: 'http://localhost:3000/plugin', whitelisted_domains: ['https://second.example/path'] },
];
let queries = 0;
const failure = new Error('database unavailable');
await mock.module('../../../../common/db', () => ({
  db: (table: string) => {
    assert.equal(table, 'plugins');
    queries += 1;
    return {
      where(filter: unknown) {
        assert.deepEqual(filter, { is_active: true });
        return {
          select(...columns: string[]) {
            assert.deepEqual(columns, ['connector_url', 'whitelisted_domains']);
            return scenario === 'failure'
              ? Promise.reject(failure)
              : Promise.resolve(scenario === 'empty' ? [] : rows);
          },
        };
      },
    };
  },
}));
const { getPluginCspOrigins } = await import('../getPluginCspOrigins');
if (scenario === 'failure') {
  await assert.rejects(getPluginCspOrigins(), (error: unknown) => error === failure);
} else {
  assert.deepEqual(await getPluginCspOrigins(), scenario === 'empty'
    ? { frameSrc: [], connectSrc: [] }
    : {
      frameSrc: ['https://plugin.example', 'http://localhost:3000'],
      connectSrc: ['https://api.example', 'http://localhost:8080', 'https://second.example'],
    });
}
assert.equal(queries, 1);
