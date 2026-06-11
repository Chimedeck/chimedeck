// Tests for idempotency — key generation and duplicate detection.
import { describe, it, expect, vi } from 'vitest';
import type { EnqueueTriggerInput } from '../../../common/types';

describe('generateIdempotencyKey', () => {
  it('generates deterministic key from input fields', async () => {
    const { generateIdempotencyKey } = await import('../index');

    const input: EnqueueTriggerInput = {
      cardId: 'card-1',
      listId: 'list-2',
      workspaceId: 'ws-1',
      boardId: 'board-1',
      phase: 'SYNC_DOCUMENT',
      moveEventId: 'event-3',
    };

    const key = generateIdempotencyKey(input);
    expect(key).toBe('card-1:list-2:SYNC_DOCUMENT:event-3');
  });

  it('produces different keys for different moveEventIds', async () => {
    const { generateIdempotencyKey } = await import('../index');

    const base: EnqueueTriggerInput = {
      cardId: 'card-1',
      listId: 'list-2',
      workspaceId: 'ws-1',
      boardId: 'board-1',
      phase: 'GENERATE_SPRINT',
      moveEventId: 'event-a',
    };

    const key1 = generateIdempotencyKey(base);
    const key2 = generateIdempotencyKey({ ...base, moveEventId: 'event-b' });

    expect(key1).not.toBe(key2);
  });

  it('produces different keys for different phases on same move', async () => {
    const { generateIdempotencyKey } = await import('../index');

    const base: EnqueueTriggerInput = {
      cardId: 'card-1',
      listId: 'list-2',
      workspaceId: 'ws-1',
      boardId: 'board-1',
      phase: 'SYNC_DOCUMENT',
      moveEventId: 'event-1',
    };

    const key1 = generateIdempotencyKey(base);
    const key2 = generateIdempotencyKey({ ...base, phase: 'UPDATE_AS_BUILT' });

    expect(key1).not.toBe(key2);
  });

  it('produces different keys for different cards', async () => {
    const { generateIdempotencyKey } = await import('../index');

    const base: EnqueueTriggerInput = {
      cardId: 'card-a',
      listId: 'list-1',
      workspaceId: 'ws-1',
      boardId: 'board-1',
      phase: 'SYNC_DOCUMENT',
      moveEventId: 'event-1',
    };

    const key1 = generateIdempotencyKey(base);
    const key2 = generateIdempotencyKey({ ...base, cardId: 'card-b' });

    expect(key1).not.toBe(key2);
  });

  it('produces different keys for different lists', async () => {
    const { generateIdempotencyKey } = await import('../index');

    const base: EnqueueTriggerInput = {
      cardId: 'card-1',
      listId: 'list-a',
      workspaceId: 'ws-1',
      boardId: 'board-1',
      phase: 'SYNC_DOCUMENT',
      moveEventId: 'event-1',
    };

    const key1 = generateIdempotencyKey(base);
    const key2 = generateIdempotencyKey({ ...base, listId: 'list-b' });

    expect(key1).not.toBe(key2);
  });
});

describe('isDuplicateRun', () => {
  it('returns true when a run with the key exists', async () => {
    const mockDb = vi.fn((_tableName: string) => ({
      where: vi.fn(() => ({
        first: vi.fn().mockResolvedValue({ id: 'existing-run', idempotency_key: 'key-1' }),
      })),
    }));

    const { isDuplicateRun } = await import('../index');
    const result = await isDuplicateRun(mockDb, 'key-1');

    expect(result).toBe(true);
  });

  it('returns false when no run with the key exists', async () => {
    const mockDb = vi.fn((_tableName: string) => ({
      where: vi.fn(() => ({
        first: vi.fn().mockResolvedValue(null),
      })),
    }));

    const { isDuplicateRun } = await import('../index');
    const result = await isDuplicateRun(mockDb, 'key-nonexistent');

    expect(result).toBe(false);
  });
});
