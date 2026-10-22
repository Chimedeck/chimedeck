import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'bun';
import type { Knex } from 'knex';
import { env } from '../../server/config/env';

// This suite is opt-in and cannot run mutations against a shared or development DB.
const database = new URL(env.DATABASE_URL || 'postgresql://disabled/disabled');
const localTest =
  ['localhost', '127.0.0.1'].includes(database.hostname) &&
  database.pathname === '/chimedeck_mobile_push_test' &&
  env.MOBILE_PUSH_ENABLED;

describe.skipIf(!localTest)('mobile push through local HTTP/auth/PostgreSQL', () => {
  let db: Knex;
  let server: Server<undefined>;
  let firstToken: string, secondToken: string;
  let publish: typeof import('../../server/extensions/realtime/userChannel').publishToUser;
  let deliver: typeof import('../../server/extensions/notifications/push/queue').deliverPushBatch;
  const users = [crypto.randomUUID(), crypto.randomUUID()];
  const device = {
    id: crypto.randomUUID(),
    secret: 'local-installation-proof-'.repeat(4),
    token: 'local-fcm-token-for-database-verification-only',
    platform: 'android',
    environment: 'development',
  };

  async function request({
    path,
    method = 'GET',
    body,
    token = firstToken,
  }: {
    path: string;
    method?: string;
    body?: unknown;
    token?: string | null;
  }) {
    return fetch(new URL(path, server.url), {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  async function register() {
    const response = await request({
      path: '/api/v1/notifications/devices',
      method: 'PUT',
      body: device,
    });
    expect(response.status).toBe(200);
  }
  async function notification({
    userId = users[0]!,
    type = 'mention',
    read = false,
  }: {
    userId?: string;
    type?: string;
    read?: boolean;
  } = {}) {
    const value = {
      id: crypto.randomUUID(),
      user_id: userId,
      actor_id: users[1],
      type,
      read,
      source_type: 'board_activity',
      source_id: crypto.randomUUID(),
      card_id: null,
      board_id: null,
    };
    await db('notifications').insert(value);
    return value;
  }
  async function queued() {
    await register();
    const value = await notification();
    const event = { type: 'notification_created', payload: { notification: value } };
    await publish(users[0]!, event);
    await publish(users[0]!, event);
    expect(await db('notification_push_jobs').where({ notification_id: value.id })).toHaveLength(1);
    return value;
  }

  beforeAll(async () => {
    db = (await import('../../server/common/db')).db;
    const { issueAccessToken } = await import('../../server/extensions/auth/mods/token/issue');
    const { notificationsRouter } = await import('../../server/extensions/notifications/api');
    publish = (await import('../../server/extensions/realtime/userChannel')).publishToUser;
    deliver = (await import('../../server/extensions/notifications/push/queue')).deliverPushBatch;
    await db('users').insert(
      users.map((id, index) => ({
        id,
        name: 'Synthetic push test',
        email: `push-${index}-${id}@example.test`,
      }))
    );
    firstToken = await issueAccessToken({ sub: users[0]!, email: `first@example.test` });
    secondToken = await issueAccessToken({ sub: users[1]!, email: `second@example.test` });
    server = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      async fetch(req) {
        return (
          (await notificationsRouter(req, new URL(req.url).pathname)) ??
          new Response(null, { status: 404 })
        );
      },
    });
  });
  beforeEach(async () => {
    await db('notifications').whereIn('user_id', users).delete();
    await db('notification_devices').whereIn('user_id', users).delete();
    await db('user_notification_settings').whereIn('user_id', users).delete();
  });
  afterAll(async () => {
    server?.stop(true);
    if (db) {
      await db('users').whereIn('id', users).delete();
      await db.destroy();
    }
  });

  test('migration down/up preserves its schema contract in the isolated database', async () => {
    const migration = await import('../../db/migrations/0134_mobile_push');
    await db.transaction(async (trx) => {
      await migration.down(trx);
      expect(await trx.schema.hasTable('notification_devices')).toBe(false);
      await migration.up(trx);
      expect(await trx.schema.hasColumn('notification_devices', 'secret_hash')).toBe(true);
      expect(await trx.schema.hasColumn('notification_push_jobs', 'locked_until')).toBe(true);
    });
  });
  test('HTTP registration and proof revocation preserve account ownership', async () => {
    expect(
      (
        await request({
          path: '/api/v1/notifications/devices',
          method: 'PUT',
          body: device,
          token: null,
        })
      ).status
    ).toBe(401);
    await register();
    let stored = await db('notification_devices').where({ id: device.id }).first();
    expect(stored.user_id).toBe(users[0]);
    expect(stored.secret_hash).not.toBe(device.secret);
    expect(stored.secret_hash).toHaveLength(64);
    expect(
      (
        await request({
          path: '/api/v1/notifications/devices',
          method: 'PUT',
          body: { ...device, secret: 'wrong-proof-'.repeat(8) },
          token: secondToken,
        })
      ).status
    ).toBe(409);
    expect(
      (
        await request({
          path: '/api/v1/notifications/devices',
          method: 'PUT',
          body: device,
          token: secondToken,
        })
      ).status
    ).toBe(200);
    const path = `/api/v1/notifications/devices/${device.id}/revoke`;
    expect(
      (
        await request({
          path,
          method: 'POST',
          body: { secret: device.secret, user_id: users[0] },
          token: null,
        })
      ).status
    ).toBe(204);
    stored = await db('notification_devices').where({ id: device.id }).first();
    expect(stored.user_id).toBe(users[1]);
    expect(stored.enabled).toBe(true);
    expect((await request({ path, method: 'POST', body: null, token: null })).status).toBe(400);
    expect(
      (
        await request({
          path,
          method: 'POST',
          body: { secret: device.secret, user_id: users[1] },
          token: null,
        })
      ).status
    ).toBe(204);
    expect((await db('notification_devices').where({ id: device.id }).first()).enabled).toBe(false);
  });
  test('the exact unread HTTP total excludes another account and hidden rows', async () => {
    await notification();
    await notification({ read: true });
    await notification({ type: 'card_updated' });
    await notification({ userId: users[1]! });
    const response = await request({ path: '/api/v1/notifications/unread-count' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { count: 1 } });
  });
  test('publication deduplicates jobs and the real lease/store completes a send', async () => {
    await queued();
    let sends = 0;
    await deliver({
      send: async (recipient) => {
        sends++;
        expect(recipient.data.user_id).toBe(users[0]!);
        expect(recipient.data.environment).toBe('development');
        expect(Object.keys(recipient.data)).not.toContain('comment_content');
      },
    });
    expect(sends).toBe(1);
    expect(await db('notification_push_jobs').where({ user_id: users[0] })).toHaveLength(0);
  });
  test('the real store rechecks read and global notification preferences', async () => {
    const value = await queued();
    await db('notifications').where({ id: value.id }).update({ read: true });
    let sends = 0;
    await deliver({
      send: async () => {
        sends++;
      },
    });
    expect(sends).toBe(0);
    await db('notifications').where({ id: value.id }).update({ read: false });
    await db('user_notification_settings').insert({
      user_id: users[0],
      global_notifications_enabled: false,
    });
    await publish(users[0]!, { type: 'notification_created', payload: { notification: value } });
    await deliver({
      send: async () => {
        sends++;
      },
    });
    expect(sends).toBe(0);
    expect(await db('notification_push_jobs').where({ user_id: users[0] })).toHaveLength(0);
  });
  test('invalidating an attempted token cannot disable a concurrent rotation', async () => {
    await queued();
    await deliver({
      send: async () => {
        await db('notification_devices')
          .where({ id: device.id })
          .update({ token: device.token + '-rotated' });
        throw { code: 'messaging/registration-token-not-registered' };
      },
    });
    const stored = await db('notification_devices').where({ id: device.id }).first();
    expect(stored.enabled).toBe(true);
    expect(stored.token).toEndWith('-rotated');
    expect(await db('notification_push_jobs').where({ user_id: users[0] })).toHaveLength(0);
  });
  test('transient sender failures persist bounded retry state', async () => {
    await queued();
    await deliver({
      send: async () => {
        throw new Error('synthetic-offline');
      },
    });
    const job = await db('notification_push_jobs').where({ user_id: users[0] }).first();
    expect(job.attempts).toBe(1);
    expect(job.locked_until).toBeNull();
    expect(job.failed_at).toBeNull();
    expect(new Date(job.next_attempt_at).getTime()).toBeGreaterThan(Date.now());
  });
});
