// Subprocess fixture: exercises handleForgotPassword with a mocked DB module
// isolated in a child process so the shared db mock cannot leak into the suite.
import { mock } from 'bun:test';
import assert from 'node:assert/strict';

const scenario = process.argv[2];

const existingUser = { id: 'user-a', email: 'known@example.com' };
const calls: { table: string; op: string; filter?: unknown; payload?: unknown }[] = [];
const sentEmails: { to: string; subject: string }[] = [];

void mock.module('../../../common/db', () => ({
  db: (table: string) => ({
    where: (filter: unknown) => ({
      first: () => {
        calls.push({ table, op: 'first', filter });
        if (scenario === 'missing-user') return Promise.resolve(undefined);
        return Promise.resolve(existingUser);
      },
      update: (payload: unknown) => {
        calls.push({ table, op: 'update', filter, payload });
        return Promise.resolve(1);
      },
    }),
  }),
}));

void mock.module('../../email', () => ({
  send: (payload: { to: string; subject: string }) => {
    sentEmails.push({ to: payload.to, subject: payload.subject });
    return Promise.resolve();
  },
}));

void mock.module('../../email/templates/passwordResetEmail', () => ({
  buildPasswordResetEmail: () =>
    Promise.resolve({ subject: 'Reset your password', html: '<p>reset</p>', text: 'reset' }),
}));

const { handleForgotPassword } = await import('./forgotPassword');

if (scenario === 'rate-limited') {
  const req = () =>
    new Request('http://127.0.0.1/api/v1/auth/forgot-password', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.9' },
      body: JSON.stringify({ email: existingUser.email }),
    });
  // Exhaust the 5/hour limit, then confirm the 6th request is short-circuited.
  for (let i = 0; i < 5; i++) {
    const res = await handleForgotPassword(req());
    assert.equal(res.status, 200);
  }
  const beforeCalls = calls.length;
  const limited = await handleForgotPassword(req());
  assert.equal(limited.status, 200);
  assert.deepEqual(await limited.json(), { data: { sent: true } });
  assert.equal(calls.length, beforeCalls, 'rate-limited request must not touch the database');
  assert.equal(sentEmails.length, 5, 'only the first 5 requests should send email');
} else if (scenario === 'bad-json') {
  const res = await handleForgotPassword(
    new Request('http://127.0.0.1/api/v1/auth/forgot-password', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.10' },
      body: '{not-json',
    }),
  );
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), {
    error: { code: 'bad-request', message: 'Invalid JSON body' },
  });
  assert.equal(calls.length, 0);
} else if (scenario === 'missing-email') {
  const res = await handleForgotPassword(
    new Request('http://127.0.0.1/api/v1/auth/forgot-password', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.11' },
      body: JSON.stringify({}),
    }),
  );
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), {
    error: { code: 'bad-request', message: 'email is required' },
  });
  assert.equal(calls.length, 0);
} else if (scenario === 'missing-user') {
  const res = await handleForgotPassword(
    new Request('http://127.0.0.1/api/v1/auth/forgot-password', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.12' },
      body: JSON.stringify({ email: 'nobody@example.com' }),
    }),
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { data: { sent: true } });
  // Must look up the user but never issue an update or send an email — no enumeration signal.
  assert.deepEqual(calls, [
    { table: 'users', op: 'first', filter: { email: 'nobody@example.com' } },
  ]);
  assert.equal(sentEmails.length, 0);
} else if (scenario === 'known-user') {
  const res = await handleForgotPassword(
    new Request('http://127.0.0.1/api/v1/auth/forgot-password', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.13' },
      body: JSON.stringify({ email: '  Known@Example.com  ' }),
    }),
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { data: { sent: true } });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], {
    table: 'users',
    op: 'first',
    filter: { email: 'known@example.com' },
  });
  const updateCall = calls[1];
  assert.ok(updateCall);
  assert.equal(updateCall.table, 'users');
  assert.equal(updateCall.op, 'update');
  assert.deepEqual(updateCall.filter, { id: existingUser.id });
  const payload = updateCall.payload as { password_reset_token: string; password_reset_token_expires_at: Date };
  assert.equal(typeof payload.password_reset_token, 'string');
  assert.equal(payload.password_reset_token.length, 64);
  assert.ok(payload.password_reset_token_expires_at instanceof Date);
  assert.equal(sentEmails.length, 1);
  assert.deepEqual(sentEmails[0], { to: 'known@example.com', subject: 'Reset your password' });
} else {
  throw new Error(`unknown scenario: ${scenario ?? '(none)'}`);
}
