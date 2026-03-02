import { describe, it, expect } from 'bun:test';
import { InMemoryPubSubAdapter } from './inMemory';

describe('InMemoryPubSubAdapter', () => {
  it('delivers messages to subscribers', async () => {
    const adapter = new InMemoryPubSubAdapter();
    const received: string[] = [];

    await adapter.subscribe('test-channel', (msg) => received.push(msg));
    await adapter.publish('test-channel', 'hello');

    expect(received).toEqual(['hello']);
  });

  it('does not deliver after unsubscribe', async () => {
    const adapter = new InMemoryPubSubAdapter();
    const received: string[] = [];

    await adapter.subscribe('ch', (msg) => received.push(msg));
    await adapter.unsubscribe('ch');
    await adapter.publish('ch', 'should not arrive');

    expect(received).toHaveLength(0);
  });

  it('delivers to multiple subscribers on same channel', async () => {
    const adapter = new InMemoryPubSubAdapter();
    const a: string[] = [];
    const b: string[] = [];

    await adapter.subscribe('multi', (msg) => a.push(msg));
    await adapter.subscribe('multi', (msg) => b.push(msg));
    await adapter.publish('multi', 'msg');

    expect(a).toEqual(['msg']);
    expect(b).toEqual(['msg']);
  });
});
