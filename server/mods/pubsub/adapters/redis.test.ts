import { describe, it, expect } from 'bun:test';
import { RedisPubSubAdapter } from './redis';

// Skip if no Redis URL is configured.
const REDIS_URL = Bun.env['REDIS_URL'];
const describeIfRedis = REDIS_URL ? describe : describe.skip;

describeIfRedis('RedisPubSubAdapter', () => {
  it('implements PubSubProvider interface', () => {
    const adapter = new RedisPubSubAdapter(REDIS_URL!);
    expect(typeof adapter.publish).toBe('function');
    expect(typeof adapter.subscribe).toBe('function');
    expect(typeof adapter.unsubscribe).toBe('function');
  });

  it('updates the handler in place when subscribing twice to the same channel (no throw)', async () => {
    const adapter = new RedisPubSubAdapter(REDIS_URL!);
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
    // ioredis keeps it alive) — it does not throw. The PR's delta had removed the
    // await AND asserted a rejection that can never happen; awaiting it exposed
    // the false premise. This pins the real in-place-update contract: no throw,
    // no second Redis SUBSCRIBE issued, handlers map keeps one entry.
    await expect(adapter.subscribe('test:dup-guard', second)).resolves.toBeUndefined();
    expect(subCalls).toEqual(['test:dup-guard']);
    expect(((adapter as unknown as { handlers: Map<string, unknown> }).handlers).size).toBe(1);
    await adapter.unsubscribe('test:dup-guard');
  });
});
