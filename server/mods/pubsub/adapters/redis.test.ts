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
});
