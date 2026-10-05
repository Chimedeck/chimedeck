import { strict as assert } from 'node:assert';
import { mock } from 'bun:test';

// Real handler under test: handleListTokens. Shared db and authenticate
// modules are mocked here in a subprocess so this fixture cannot leak
// state into (or be replaced by) adjacent test files.
const calls: unknown[][] = [];

const state: {
  currentUser: { id: string; email: string } | undefined;
  rows: Array<{
    id: string;
    name: string;
    token_prefix: string;
    expires_at: string | null;
    last_used_at: string | null;
    created_at: string;
  }>;
} = {
  currentUser: { id: 'user-1', email: 'user1@example.com' },
  rows: [
    {
      id: 'tok-1',
      name: 'CI token',
      token_prefix: 'hf_abc123',
      expires_at: null,
      last_used_at: '2026-02-01T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'tok-2',
      name: 'Deploy token',
      token_prefix: 'hf_def456',
      expires_at: '2026-06-01T00:00:00.000Z',
      last_used_at: null,
      created_at: '2026-01-02T00:00:00.000Z',
    },
  ],
};

void mock.module('../../../../../common/db', () => ({
  db: (table: string) => {
    calls.push(['db', table]);
    assert.equal(table, 'api_tokens');
    return {
      where: (filter: Record<string, unknown>) => {
        calls.push(['where', filter]);
        assert.deepEqual(filter, { user_id: 'user-1' });
        return {
          whereNull: (col: string) => {
            calls.push(['whereNull', col]);
            assert.equal(col, 'revoked_at');
            return {
              orderBy: (col: string, dir: string) => {
                calls.push(['orderBy', col, dir]);
                assert.equal(col, 'created_at');
                assert.equal(dir, 'desc');
                return {
                  select: (...cols: unknown[]) => {
                    calls.push(['select', cols]);
                    assert.deepEqual(cols, [
                      'id',
                      'name',
                      'token_prefix',
                      'expires_at',
                      'last_used_at',
                      'created_at',
                    ]);
                    return Promise.resolve(state.rows);
                  },
                };
              },
            };
          },
        };
      },
    };
  },
}));

void mock.module('../../../../auth/middlewares/authentication', () => ({
  authenticate: (req: { currentUser?: { id: string; email: string } }) => {
    calls.push(['authenticate']);
    if (!state.currentUser) {
      return Promise.resolve(
        Response.json({ error: { code: 'unauthorized', message: 'Missing Bearer token' } }, { status: 401 }),
      );
    }
    req.currentUser = state.currentUser;
    return Promise.resolve(null);
  },
}));

async function run(): Promise<void> {
  const { handleListTokens } = await import('../../list');

  // 1. Unauthenticated request short-circuits with the auth middleware's response.
  state.currentUser = undefined;
  const unauthedReq = new Request('http://localhost/api/v1/tokens');
  const unauthedRes = await handleListTokens(unauthedReq);
  assert.equal(unauthedRes.status, 401);

  // 2. Authenticated request scopes the query to the current user and
  //    excludes revoked tokens, ordered by created_at desc.
  state.currentUser = { id: 'user-1', email: 'user1@example.com' };
  calls.length = 0;
  const authedReq = new Request('http://localhost/api/v1/tokens');
  const authedRes = await handleListTokens(authedReq);
  assert.equal(authedRes.status, 200);
  const body = (await authedRes.json()) as {
    data: Array<{
      id: string;
      name: string;
      prefix: string;
      expiresAt: string | null;
      lastUsedAt: string | null;
      createdAt: string;
    }>;
  };

  // 3. Response never surfaces raw token/hash — only the documented public shape.
  assert.equal(body.data.length, 2);
  for (const item of body.data) {
    assert.equal(Object.prototype.hasOwnProperty.call(item, 'token'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(item, 'token_hash'), false);
  }
  assert.deepEqual(body.data[0], {
    id: 'tok-1',
    name: 'CI token',
    prefix: 'hf_abc123',
    expiresAt: null,
    lastUsedAt: '2026-02-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  assert.deepEqual(body.data[1], {
    id: 'tok-2',
    name: 'Deploy token',
    prefix: 'hf_def456',
    expiresAt: '2026-06-01T00:00:00.000Z',
    lastUsedAt: null,
    createdAt: '2026-01-02T00:00:00.000Z',
  });

  // 4. Missing-optional-field nulling: expires_at/last_used_at `??` fallback preserved.
  state.rows = [
    {
      id: 'tok-3',
      name: 'No optional fields',
      token_prefix: 'hf_ghi789',
      expires_at: undefined as unknown as null,
      last_used_at: undefined as unknown as null,
      created_at: '2026-01-03T00:00:00.000Z',
    },
  ];
  const nullFallbackRes = await handleListTokens(new Request('http://localhost/api/v1/tokens'));
  const nullFallbackBody = (await nullFallbackRes.json()) as {
    data: Array<{ expiresAt: string | null; lastUsedAt: string | null }>;
  };
  const [nullFallbackItem] = nullFallbackBody.data;
  assert.ok(nullFallbackItem);
  assert.equal(nullFallbackItem.expiresAt, null);
  assert.equal(nullFallbackItem.lastUsedAt, null);

  assert.ok(calls.some((entry) => entry[0] === 'authenticate'));
  assert.ok(calls.some((entry) => entry[0] === 'select'));

  console.info(
    'handleListTokens real user-scope filter, revoked exclusion, ordering, and public-field-only response verified',
  );
}

run().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
