import { describe, it, expect } from 'bun:test';
import { publisher } from './publisher';

describe('publisher', () => {
  it('exports publish function', () => {
    expect(typeof publisher.publish).toBe('function');
  });

  it('returns a promise', async () => {
    // The in-memory pubsub has no subscribers here, so this should resolve without error.
    const result = publisher.publish('test-board-id', JSON.stringify({ type: 'test' }));
    expect(result).toBeInstanceOf(Promise);
    await result;
  });
});
