import { describe, it, expect } from 'bun:test';
import { RedisPubSubAdapter } from './redis';

// [why unconditional + dummy URL] Copilot round-2: the corrected contract test sat
// inside describeIfRedis, so ordinary runs (no REDIS_URL) skipped it even though
// the adapter only touches Redis lazily (clients use lazyConnect) and this suite
// replaces the internal sub client — a dummy URL is enough to exercise the real
// in-process handler-map logic on every run.
const REDIS_URL = 'redis://127.0.0.1:6379/15';

describe('RedisPubSubAdapter', () => {
  it('implements PubSubProvider interface', () => {
    const adapter = new RedisPubSubAdapter(REDIS_URL);
    expect(typeof adapter.publish).toBe('function');
    expect(typeof adapter.subscribe).toBe('function');
    expect(typeof adapter.unsubscribe).toBe('function');
  });

  it('updates the handler in place when subscribing twice to the same channel (no throw)', async () => {
    const adapter = new RedisPubSubAdapter(REDIS_URL);
    // Patch internal sub to avoid needing a live Redis connection for this unit test.
    const subCalls: string[] = [];
    (adapter as any).sub = {
      subscribe: async (channel: string) => {
        subCalls.push(channel);
      },
      unsubscribe: async (channel: string) => {
        subCalls.push(`un:${channel}`);
      },
    };
    const first: (msg: string) => void = () => {};
    const second: (msg: string) => void = () => {};
    await adapter.subscribe('test:dup-guard', first);
    // [why awaited + contract, not reject] The adapter intentionally updates the
    // handler in place on a duplicate subscribe (Redis SUBSCRIBE already issued,
    // ioredis keeps it alive) — it does not throw. The #347 delta had removed the
    // await AND asserted a rejection that can never happen; awaiting it exposed
    // the false premise. This pins the real in-place-update contract: no throw,
    // no second Redis SUBSCRIBE issued, the map keeps one entry, and the stored
    // handler IS the replacement (an implementation leaving `first` installed
    // would fail this assertion).
    await expect(adapter.subscribe('test:dup-guard', second)).resolves.toBeUndefined();
    expect(subCalls).toEqual(['test:dup-guard']);
    const handlers = (adapter as unknown as { handlers: Map<string, (msg: string) => void> }).handlers;
    expect(handlers.size).toBe(1);
    expect(handlers.get('test:dup-guard')).toBe(second);
    await adapter.unsubscribe('test:dup-guard');
  });
});
