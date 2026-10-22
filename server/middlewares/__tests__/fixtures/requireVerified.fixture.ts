import { strict as assert } from 'node:assert';
import { mock } from 'bun:test';
import type { AuthenticatedRequest } from '../../../extensions/auth/middlewares/authentication';

let enabled = true;
let row: { email_verified: boolean } | undefined;
const errors: { flag?: Error; db?: Error } = {};
const calls: unknown[] = [];

void mock.module('../../../common/db', () => ({
  db(table: string) {
    calls.push(['table', table]);
    return {
      where(condition: unknown) {
        calls.push(['where', condition]);
        return this;
      },
      select(column: string) {
        calls.push(['select', column]);
        return this;
      },
      first() {
        calls.push(['first']);
        return errors.db ? Promise.reject(errors.db) : Promise.resolve(row);
      },
    };
  },
}));
void mock.module('../../../mods/flags', () => ({
  flags: {
    isEnabled(key: string) {
      calls.push(['flag', key]);
      return errors.flag ? Promise.reject(errors.flag) : Promise.resolve(enabled);
    },
  },
}));

const { requireVerified } = await import('../../requireVerified');
function request(id?: string): AuthenticatedRequest {
  const req: AuthenticatedRequest = new Request('http://127.0.0.1/private');
  if (id !== undefined) req.currentUser = { id, email: 'user@example.test' };
  return req;
}
const flagCall = ['flag', 'EMAIL_VERIFICATION_ENABLED'];
const queryCalls = [flagCall, ['table', 'users'], ['where', { id: 'user-1' }], ['select', 'email_verified'], ['first']];

enabled = false;
for (const req of [request(), request('user-1')]) {
  calls.length = 0;
  assert.equal(await requireVerified(req), null);
  assert.deepEqual(calls, [flagCall]);
}
enabled = true;
for (const req of [request(), request('')]) {
  calls.length = 0;
  const response = await requireVerified(req);
  assert.equal(response?.status, 401);
  assert.deepEqual(await response.json(), { error: { code: 'unauthorized', message: 'Authentication required' } });
  assert.deepEqual(calls, [flagCall]);
}
for (const result of [undefined, { email_verified: false }, { email_verified: true }]) {
  row = result;
  calls.length = 0;
  const response = await requireVerified(request('user-1'));
  if (result?.email_verified) {
    assert.equal(response, null);
  } else {
    assert.equal(response?.status, 403);
    assert.deepEqual(await response.json(), { error: { code: 'email-not-verified', message: 'Please verify your email to continue.' } });
  }
  assert.deepEqual(calls, queryCalls);
}
errors.db = new Error('database unavailable');
calls.length = 0;
await assert.rejects(requireVerified(request('user-1')), errors.db);
assert.deepEqual(calls, queryCalls);
errors.flag = new Error('flags unavailable');
calls.length = 0;
await assert.rejects(requireVerified(request('user-1')), errors.flag);
assert.deepEqual(calls, [flagCall]);
