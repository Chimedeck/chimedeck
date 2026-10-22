import { beforeEach, test, expect, mock } from 'bun:test';
import { secretHash } from './contracts';
const devices: Record<string, unknown>[] = [],
  notifications: Record<string, unknown>[] = [];
class Query {
  filters: Array<(row: Record<string, unknown>) => boolean> = [];
  constructor(readonly rows: Record<string, unknown>[]) {}
  where(value: Record<string, unknown>) {
    this.filters.push((row) => Object.entries(value).every(([k, v]) => row[k] === v));
    return this;
  }
  whereNot(key: string, value: unknown) {
    this.filters.push((row) => row[key] !== value);
    return this;
  }
  selected() {
    return this.rows.filter((row) => this.filters.every((filter) => filter(row)));
  }
  async first() {
    return this.selected()[0];
  }
  count() {
    return { first: async () => ({ count: this.selected().length }) };
  }
  async update(value: Record<string, unknown>) {
    this.selected().forEach((row) => Object.assign(row, value));
  }
  async delete() {
    for (const row of this.selected()) this.rows.splice(this.rows.indexOf(row), 1);
  }
  insert(value: Record<string, unknown>) {
    return {
      onConflict: () => ({
        merge: async () => {
          const existing = this.rows.find((row) => row.id === value.id);
          if (existing) Object.assign(existing, value);
          else this.rows.push({ ...value });
        },
      }),
    };
  }
}
const db = Object.assign(
  (table: string) => new Query(table === 'notification_devices' ? devices : notifications),
  {
    transaction: async (fn: (trx: typeof db) => Promise<unknown>): Promise<unknown> => fn(db),
    raw: async () => {},
  }
);
void mock.module('../../../common/db', () => ({ db }));
void mock.module('../../auth/middlewares/authentication', () => ({
  authenticate: async (req: Request & { currentUser?: { id: string } }) => {
    if (!req.headers.get('Authorization')) return new Response(null, { status: 401 });
    req.currentUser = { id: req.headers.get('x-user-id') ?? 'user-1' };
    return null;
  },
}));
let enabled = true;
void mock.module('./firebase', () => ({ pushEnabled: () => enabled }));
const { pushRouter } = await import('./api');
const secret = 's'.repeat(64);
const device = {
  id: 'fixture-installation-1234',
  secret,
  token: 'fixture-token-'.repeat(4),
  platform: 'ios',
  environment: 'development',
};
async function call({
  path,
  method = 'GET',
  body,
  user = 'user-1',
  authenticated = true,
}: {
  path: string;
  method?: string;
  body?: unknown;
  user?: string;
  authenticated?: boolean;
}) {
  const req = new Request('https://example.com' + path, {
    method,
    headers: {
      ...(authenticated ? { Authorization: 'Bearer fixture' } : {}),
      'x-user-id': user,
      'content-type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return pushRouter({ req, pathname: path });
}
beforeEach(() => {
  devices.length = 0;
  notifications.length = 0;
  enabled = true;
});
test('device registration and unread counts require authentication', async () => {
  const path = '/api/v1/notifications/devices';
  expect((await call({ path, method: 'PUT', body: device, authenticated: false }))?.status).toBe(
    401
  );
  expect(devices).toHaveLength(0);
  notifications.push(
    { id: 'a', user_id: 'user-1', type: 'mention', read: false },
    { id: 'b', user_id: 'other', type: 'mention', read: false },
    { id: 'c', user_id: 'user-1', type: 'card_updated', read: false }
  );
  expect(await (await call({ path: '/api/v1/notifications/unread-count' }))?.json()).toEqual({
    data: { count: 1 },
  });
});
test('registration binds the authenticated user and requires proof to reuse an installation', async () => {
  const path = '/api/v1/notifications/devices';
  expect((await call({ path, method: 'PUT', body: device }))?.status).toBe(200);
  expect(devices[0]?.user_id).toBe('user-1');
  expect(devices[0]?.secret_hash).toBe(secretHash({ secret }));
  expect(
    (
      await call({
        path,
        method: 'PUT',
        body: { ...device, secret: 'wrong'.repeat(16) },
        user: 'other',
      })
    )?.status
  ).toBe(409);
  expect(devices[0]?.user_id).toBe('user-1');
  expect((await call({ path, method: 'PUT', body: device, user: 'other' }))?.status).toBe(200);
  expect(devices[0]?.user_id).toBe('other');
});
test('a late logout can revoke only the old account mapping with the correct proof', async () => {
  const path = '/api/v1/notifications/devices/' + device.id + '/revoke';
  devices.push({
    ...device,
    secret_hash: secretHash({ secret }),
    user_id: 'new-user',
    enabled: true,
  });
  await call({ path, method: 'POST', body: { secret, user_id: 'old-user' }, authenticated: false });
  expect(devices[0]?.enabled).toBe(true);
  await call({
    path,
    method: 'POST',
    body: { secret: 'wrong'.repeat(16), user_id: 'new-user' },
    authenticated: false,
  });
  expect(devices[0]?.enabled).toBe(true);
  await call({ path, method: 'POST', body: { secret, user_id: 'new-user' }, authenticated: false });
  expect(devices[0]?.enabled).toBe(false);
});
test('malformed proof bodies fail safely with structured errors', async () => {
  const path = '/api/v1/notifications/devices/' + device.id + '/revoke';
  for (const body of [null, [], 'invalid']) {
    const response = await call({ path, method: 'POST', body, authenticated: false });
    expect(response?.status).toBe(400);
    expect(await response?.json()).toEqual({
      name: 'invalid-device',
      data: { message: 'Expected a JSON object.' },
    });
  }
  const malformed = new Request('https://example.com' + path, { method: 'POST', body: '{broken' });
  expect((await pushRouter({ req: malformed, pathname: path }))?.status).toBe(400);
});
test('an unavailable sender refuses registrations without inserting a device', async () => {
  enabled = false;
  const response = await call({
    path: '/api/v1/notifications/devices',
    method: 'PUT',
    body: device,
  });
  expect(response?.status).toBe(503);
  expect((await response?.json()).name).toBe('push-unavailable');
  expect(devices).toHaveLength(0);
});
