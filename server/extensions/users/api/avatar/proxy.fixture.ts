import assert from 'node:assert/strict';
import { mock } from 'bun:test';

let authError: Response | undefined;
let row: { id: string; avatar_url: string | null } | undefined;
const calls: unknown[] = [];
let signError: Error | undefined;
void mock.module('../../../auth/middlewares/authentication', () => ({
  authenticate: (req: Request) => {
    calls.push(['authenticate', req.url]);
    return Promise.resolve(authError);
  },
}));
void mock.module('../../../../common/db', () => ({
  db: (table: string) => {
    calls.push(['db', table]);
    return {
      where: (condition: unknown) => {
        calls.push(['where', condition]);
        return {
          select: (...columns: string[]) => {
            calls.push(['select', columns]);
            return { first: () => Promise.resolve(row) };
          },
        };
      },
    };
  },
}));
void mock.module('../../../attachment/common/presign', () => ({
  presignGetUrl: (input: { s3Key: string; ttlSeconds: number }) => {
    calls.push(['presign', input]);
    return signError
      ? Promise.reject(signError)
      : Promise.resolve({ url: 'https://signed.example/avatar?token=secret' });
  },
}));
// Keep the real key extractor; only replace its S3 configuration dependency.
void mock.module('../../../attachment/common/config/s3', () => ({
  s3Config: { bucket: 'avatars-bucket' },
  s3Client: {},
}));
const { handleAvatarProxy } = await import('./proxy');
const req = new Request('http://127.0.0.1/api/v1/users/target/avatar');
function reset(avatar: string | null | undefined) {
  calls.length = 0;
  authError = undefined;
  signError = undefined;
  row = avatar === undefined ? undefined : { id: 'target', avatar_url: avatar };
}
reset('avatars/target.png');
authError = Response.json({ error: 'unauthorized' }, { status: 401 });
assert.equal(await handleAvatarProxy(req, 'target'), authError);
assert.deepEqual(calls, [['authenticate', req.url]]);

for (const avatar of [undefined, null, '']) {
  reset(avatar);
  const response = await handleAvatarProxy(req, 'target');
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), avatar === undefined
    ? { name: 'user-not-found', data: { message: 'User not found' } }
    : { name: 'avatar-not-set', data: { message: 'User has no avatar' } });
  assert.deepEqual(calls, [
    ['authenticate', req.url], ['db', 'users'], ['where', { id: 'target' }],
    ['select', ['id', 'avatar_url']],
  ]);
}
reset('https://github.example/avatar.png');
const external = await handleAvatarProxy(req, 'target');
assert.equal(external.status, 302);
assert.equal(external.headers.get('location'), 'https://github.example/avatar.png');
assert.equal(calls.length, 4);

for (const avatar of ['avatars/target.png', 'https://s3.example/avatars-bucket/avatars/target.png']) {
  reset(avatar);
  const response = await handleAvatarProxy(req, 'target');
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://signed.example/avatar?token=secret');
  assert.equal(await response.text(), '');
  assert.deepEqual(calls, [
    ['authenticate', req.url], ['db', 'users'], ['where', { id: 'target' }],
    ['select', ['id', 'avatar_url']],
    ['presign', { s3Key: 'avatars/target.png', ttlSeconds: 60 }],
  ]);
}
reset('avatars/target.png');
signError = new Error('signing failed');
await assert.rejects(handleAvatarProxy(req, 'target'), signError);
