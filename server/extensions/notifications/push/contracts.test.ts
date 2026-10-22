import { describe, test, expect } from 'bun:test';
import { ownsDevice, secretHash, parseDevice, pushBody, pushData } from './contracts';
import { deliverPushJob, type PushJobStore, type PushRecipient } from './delivery';

describe('mobile push boundaries', () => {
  test('device registration validates platform, environment, identity and proof', () => {
    const device = {
      id: 'fixture-installation-1234',
      secret: 's'.repeat(64),
      token: 'fixture-token-'.repeat(4),
      platform: 'ios',
      environment: 'development',
    };
    expect(parseDevice({ body: device })).not.toBeNull();
    for (const bad of [
      null,
      {},
      { ...device, environment: 'other' },
      { ...device, platform: 'web' },
      { ...device, platform: ['ios'] },
      { ...device, environment: ['development'] },
      { ...device, secret: 'short' },
    ])
      expect(parseDevice({ body: bad })).toBeNull();
    expect(ownsDevice({ secret: device.secret, hash: secretHash({ secret: device.secret }) })).toBe(
      true
    );
    expect(
      ownsDevice({ secret: 't'.repeat(64), hash: secretHash({ secret: device.secret }) })
    ).toBe(false);
    expect(ownsDevice({ secret: device.secret, hash: 'not-a-hash' })).toBe(false);
  });
  test('push carries scoped IDs and neutral lock-screen text, without comment content', () => {
    const payload = pushData({
      notification: {
        id: 'n',
        source_type: 'comment',
        source_id: 'reply',
        source_parent_id: 'parent',
        card_id: 'card',
        comment_content: 'private comment',
      },
      userId: 'u',
      environment: 'production',
    });
    expect(payload.parent_id).toBe('parent');
    expect(payload.comment_id).toBe('reply');
    expect(payload.user_id).toBe('u');
    expect(payload.environment).toBe('production');
    expect(JSON.stringify(payload)).not.toContain('private');
    expect(pushBody({ type: 'mention' })).toContain('mentioned');
    expect(pushBody({ type: 'unknown' })).toBe('You have a new notification.');
  });
});
describe('durable delivery behavior', () => {
  const job = {
    id: 1,
    device_id: 'd',
    user_id: 'u',
    notification_id: 'n',
    attempts: 0,
    payload: {},
  };
  const recipient: PushRecipient = {
    token: 'old-token',
    environment: 'development',
    data: pushData({ notification: { id: 'n' }, userId: 'u', environment: 'development' }),
    type: 'mention',
  };
  function fixture(active = true) {
    const completed: unknown[] = [],
      invalidated: string[] = [],
      retried: unknown[] = [];
    const store: PushJobStore = {
      async recipient() {
        return active ? recipient : null;
      },
      async complete(value) {
        completed.push(value);
      },
      async invalidate(_, token) {
        invalidated.push(token);
      },
      async retry(_, attempts, delay, exhausted) {
        retried.push({ attempts, delay, exhausted });
      },
    };
    return { store, completed, invalidated, retried };
  }
  test('a revoked, read, muted or reassigned recipient is discarded without a send', async () => {
    const f = fixture(false);
    let sends = 0;
    await deliverPushJob({
      job,
      store: f.store,
      send: async () => {
        sends++;
      },
    });
    expect(sends).toBe(0);
    expect(f.completed).toHaveLength(1);
  });
  test('successful delivery removes the claimed job', async () => {
    const f = fixture();
    let sends = 0;
    await deliverPushJob({
      job,
      store: f.store,
      send: async (target) => {
        sends++;
        expect(target.data.user_id).toBe('u');
      },
    });
    expect(sends).toBe(1);
    expect(f.completed).toHaveLength(1);
    expect(f.retried).toHaveLength(0);
  });
  test('invalid-token handling identifies the attempted token to preserve concurrent rotation', async () => {
    const f = fixture();
    await deliverPushJob({
      job,
      store: f.store,
      send: async () => {
        throw { code: 'messaging/registration-token-not-registered' };
      },
    });
    expect(f.invalidated).toEqual(['old-token']);
    expect(f.completed).toHaveLength(1);
  });
  test('transient errors use bounded backoff and stop after eight attempts', async () => {
    const f = fixture();
    await deliverPushJob({
      job,
      store: f.store,
      send: async () => {
        throw new Error('offline');
      },
    });
    expect(f.retried).toEqual([{ attempts: 1, delay: 15000, exhausted: false }]);
    await deliverPushJob({
      job: { ...job, attempts: 7 },
      store: f.store,
      send: async () => {
        throw new Error('offline');
      },
    });
    expect(f.retried[1]).toEqual({ attempts: 8, delay: 1920000, exhausted: true });
    expect(f.invalidated).toHaveLength(0);
  });
});
