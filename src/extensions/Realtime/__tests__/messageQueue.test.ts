// Unit tests for the in-memory offline mutation queue.
import { describe, it, expect, beforeEach } from 'bun:test';
import { messageQueue, MAX_QUEUE_SIZE } from '../client/messageQueue';

function makeMutation(id: string, boardId = 'b1') {
  return {
    id,
    boardId,
    method: 'POST' as const,
    url: `/api/v1/boards/${boardId}/lists`,
    body: { title: 'Test' },
    enqueuedAt: Date.now(),
  };
}

describe('messageQueue', () => {
  beforeEach(() => {
    messageQueue.clear();
  });

  it('starts empty', () => {
    expect(messageQueue.size()).toBe(0);
  });

  it('enqueues and dequeues in FIFO order', () => {
    messageQueue.enqueue(makeMutation('m1'));
    messageQueue.enqueue(makeMutation('m2'));
    messageQueue.enqueue(makeMutation('m3'));

    expect(messageQueue.dequeue()?.id).toBe('m1');
    expect(messageQueue.dequeue()?.id).toBe('m2');
    expect(messageQueue.dequeue()?.id).toBe('m3');
    expect(messageQueue.dequeue()).toBeUndefined();
  });

  it('peek does not remove the item', () => {
    messageQueue.enqueue(makeMutation('m1'));
    expect(messageQueue.peek()?.id).toBe('m1');
    expect(messageQueue.size()).toBe(1);
  });

  it('clear removes all items', () => {
    messageQueue.enqueue(makeMutation('m1'));
    messageQueue.enqueue(makeMutation('m2'));
    messageQueue.clear();
    expect(messageQueue.size()).toBe(0);
  });

  it(`calls overflow handler and clears queue when enqueue exceeds ${MAX_QUEUE_SIZE}`, () => {
    let overflowBoardId: string | null = null;
    messageQueue.setOverflowHandler((bid) => { overflowBoardId = bid; });

    // Fill to max
    for (let i = 0; i < MAX_QUEUE_SIZE; i++) {
      messageQueue.enqueue(makeMutation(`m${i}`));
    }
    expect(messageQueue.size()).toBe(MAX_QUEUE_SIZE);

    // One more triggers overflow
    const result = messageQueue.enqueue(makeMutation('overflow', 'b2'));
    expect(result).toBe(false);
    expect(overflowBoardId).toBe('b2');
    expect(messageQueue.size()).toBe(0); // queue cleared after overflow
  });

  it('returns true when successfully enqueued', () => {
    const result = messageQueue.enqueue(makeMutation('m1'));
    expect(result).toBe(true);
  });

  it('getAll returns all items without mutating the queue', () => {
    messageQueue.enqueue(makeMutation('m1'));
    messageQueue.enqueue(makeMutation('m2'));
    const all = messageQueue.getAll();
    expect(all.length).toBe(2);
    expect(messageQueue.size()).toBe(2); // unchanged
  });
});
