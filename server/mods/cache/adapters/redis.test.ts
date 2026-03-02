import { describe, it, expect } from 'bun:test';
import { RedisCacheAdapter } from './redis';

const REDIS_URL = Bun.env['REDIS_URL'];
const describeIfRedis = REDIS_URL ? describe : describe.skip;

describeIfRedis('RedisCacheAdapter', () => {
  it('implements CacheProvider interface', () => {
    const adapter = new RedisCacheAdapter(REDIS_URL!);
    expect(typeof adapter.set).toBe('function');
    expect(typeof adapter.get).toBe('function');
    expect(typeof adapter.del).toBe('function');
    expect(typeof adapter.keys).toBe('function');
    expect(typeof adapter.incr).toBe('function');
  });
});
