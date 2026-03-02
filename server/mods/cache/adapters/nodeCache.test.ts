import { describe, it, expect, beforeEach } from 'bun:test';
import { NodeCacheAdapter, memCache } from './nodeCache';

describe('NodeCacheAdapter', () => {
  const adapter = new NodeCacheAdapter();

  it('set and get a value', async () => {
    await adapter.set('key1', 'value1');
    expect(await adapter.get('key1')).toBe('value1');
  });

  it('returns null for missing key', async () => {
    expect(await adapter.get('missing-key-xyz')).toBeNull();
  });

  it('del removes a key', async () => {
    await adapter.set('key2', 'value2');
    await adapter.del('key2');
    expect(await adapter.get('key2')).toBeNull();
  });

  it('keys matches glob pattern', async () => {
    await adapter.set('prefix:a', '1');
    await adapter.set('prefix:b', '2');
    await adapter.set('other:c', '3');
    const keys = await adapter.keys('prefix:*');
    expect(keys).toContain('prefix:a');
    expect(keys).toContain('prefix:b');
    expect(keys).not.toContain('other:c');
  });

  it('incr increments a counter', async () => {
    const key = `counter-${Date.now()}`;
    expect(await adapter.incr(key, 60)).toBe(1);
    expect(await adapter.incr(key, 60)).toBe(2);
    expect(await adapter.incr(key, 60)).toBe(3);
  });
});

describe('memCache (legacy sync API)', () => {
  it('set and get', () => {
    memCache.set('sync-key', 'sync-val');
    expect(memCache.get('sync-key')).toBe('sync-val');
  });

  it('del removes', () => {
    memCache.set('del-key', 'v');
    memCache.del('del-key');
    expect(memCache.get('del-key')).toBeNull();
  });

  it('incr increments', () => {
    const key = `sync-counter-${Date.now()}`;
    expect(memCache.incr(key, 60)).toBe(1);
    expect(memCache.incr(key, 60)).toBe(2);
  });
});
