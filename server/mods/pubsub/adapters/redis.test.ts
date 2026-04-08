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

  it('throws when subscribing twice to the same channel', async () => {
    const adapter = new RedisPubSubAdapter(REDIS_URL!);
    // Patch internal sub to avoid needing a live Redis connection for this unit test.
    (adapter as any).sub = { subscribe: async () => {}, unsubscribe: async () => {} };
    await adapter.subscribe('test:dup-guard', () => {});
    await expect(adapter.subscribe('test:dup-guard', () => {})).rejects.toThrow(
      'Already subscribed to channel: test:dup-guard'
    );
    await adapter.unsubscribe('test:dup-guard');
  });
});
