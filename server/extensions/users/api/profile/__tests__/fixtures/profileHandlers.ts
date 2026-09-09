import { strict as assert } from 'node:assert';
import { mock } from 'bun:test';

const calls: unknown[] = [];
const state: {
  authError: Response | null;
  currentUser: { id: string } | null;
  row: Record<string, unknown> | undefined;
  updated: Record<string, unknown>[];
} = { authError: null, currentUser: { id: 'user-1' }, row: undefined, updated: [] };

void mock.module('../../../../../../common/db', () => ({
  db(table: string) {
    calls.push(table);
    return {
      where(filter: Record<string, unknown>) {
        calls.push(['where', filter]);
        return this;
      },
      whereNot(filter: Record<string, unknown>) {
        calls.push(['whereNot', filter]);
        return this;
      },
      update(values: Record<string, unknown>) {
        calls.push(['update', values]);
        return this;
      },
      returning(columns: string) {
        calls.push(['returning', columns]);
        return Promise.resolve(state.updated);
      },
      first() {
        calls.push('first');
        return Promise.resolve(state.row);
      },
    };
  },
}));
void mock.module('../../../../../auth/middlewares/authentication', () => ({
  authenticate(req: Request) {
    calls.push(req);
    (req as { currentUser?: unknown }).currentUser = state.currentUser;
    return Promise.resolve(state.authError);
  },
}));
void mock.module('../../../../../../common/avatar/resolveAvatarUrl', () => ({
  buildAvatarProxyUrl({ userId, avatarUrl }: { userId: string; avatarUrl: string | null }) {
    calls.push(['buildAvatarProxyUrl', userId, avatarUrl]);
    return avatarUrl ? `/api/v1/users/${userId}/avatar` : null;
  },
}));

const { handleGetProfile } = await import('../../get');
const { handleUpdateProfile } = await import('../../update');

// --- GET: auth short-circuit ---
const getReq = new Request('http://localhost/api/v1/users/me');
state.authError = new Response('denied', { status: 401 });
assert.equal((await handleGetProfile(getReq)).status, 401);
state.authError = null;

// --- GET: missing authenticated user guard ---
state.currentUser = null;
calls.length = 0;
const noUserRes = await handleGetProfile(new Request('http://localhost/api/v1/users/me'));
assert.equal(noUserRes.status, 401);
assert.deepEqual(await noUserRes.json(), {
  error: { code: 'unauthorized', message: 'Missing authenticated user' },
});
state.currentUser = { id: 'user-1' };

// --- GET: user not found ---
state.row = undefined;
calls.length = 0;
const notFoundRes = await handleGetProfile(new Request('http://localhost/api/v1/users/me'));
assert.equal(notFoundRes.status, 404);

// --- GET: full projection, nullable fields and boolean preserved ---
state.row = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'Alice',
  nickname: null,
  avatar_url: null,
  email_verified: false,
  created_at: '2026-01-01T00:00:00.000Z',
};
calls.length = 0;
const okRes = await handleGetProfile(new Request('http://localhost/api/v1/users/me'));
assert.equal(okRes.status, 200);
assert.deepEqual(await okRes.json(), {
  data: {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Alice',
    nickname: null,
    avatar_url: null,
    email_verified: false,
    created_at: '2026-01-01T00:00:00.000Z',
  },
});

// --- UPDATE: rejects invalid nickname without touching DB ---
calls.length = 0;
const badNicknameReq = new Request('http://localhost/api/v1/users/me', {
  method: 'PATCH',
  body: JSON.stringify({ nickname: 'a b' }),
});
const badNicknameRes = await handleUpdateProfile(badNicknameReq);
assert.equal(badNicknameRes.status, 400);
assert.deepEqual(calls, [badNicknameReq]);

// --- UPDATE: nickname uniqueness conflict ---
calls.length = 0;
state.row = { id: 'user-2' };
const conflictReq = new Request('http://localhost/api/v1/users/me', {
  method: 'PATCH',
  body: JSON.stringify({ nickname: 'taken' }),
});
const conflictRes = await handleUpdateProfile(conflictReq);
assert.equal(conflictRes.status, 409);
assert.deepEqual(calls, [
  conflictReq,
  'users',
  ['where', { nickname: 'taken' }],
  ['whereNot', { id: 'user-1' }],
  'first',
]);

// --- UPDATE: applies nickname + name, returns full projection ---
calls.length = 0;
state.row = undefined;
state.updated = [{
  id: 'user-1',
  email: 'user@example.com',
  name: 'Alice B',
  nickname: 'alice_b',
  avatar_url: 's3://bucket/key',
  email_verified: true,
  created_at: '2026-01-01T00:00:00.000Z',
}];
const updateReq = new Request('http://localhost/api/v1/users/me', {
  method: 'PATCH',
  body: JSON.stringify({ nickname: 'alice_b', name: 'Alice B' }),
});
const updateRes = await handleUpdateProfile(updateReq);
assert.equal(updateRes.status, 200);
assert.deepEqual(await updateRes.json(), {
  data: {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Alice B',
    nickname: 'alice_b',
    avatar_url: '/api/v1/users/user-1/avatar',
    email_verified: true,
    created_at: '2026-01-01T00:00:00.000Z',
  },
});
assert.deepEqual(calls, [
  updateReq,
  'users',
  ['where', { nickname: 'alice_b' }],
  ['whereNot', { id: 'user-1' }],
  'first',
  'users',
  ['where', { id: 'user-1' }],
  ['update', { name: 'Alice B', nickname: 'alice_b' }],
  ['returning', '*'],
  ['buildAvatarProxyUrl', 'user-1', 's3://bucket/key'],
]);

console.info('profile get/update auth guards, nickname validation, uniqueness and projection verified');
