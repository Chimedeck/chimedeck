// server/extensions/presence/mods/expiryJob.test.ts
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { runExpiryCheck, setActiveBoardIds } from './expiryJob';

// Mock the cache module
const cacheKeys: Record<string, string[]> = {};
mock.module('../../../mods/cache/index', () => ({
  cache: {
    keys: async (pattern: string) => {
      // Pattern is "presence:<boardId>:*" — return stored keys
      const boardId = pattern.split(':')[1];
      return cacheKeys[boardId ?? ''] ?? [];
    },
    set: async () => {},
    get: async () => null,
    del: async () => {},
    incr: async () => 1,
  },
}));

// Mock broadcastPresenceUpdate
const broadcasts: Array<{ boardId: string; action: string; userId: string }> = [];
mock.module('../api/presenceUpdate', () => ({
  broadcastPresenceUpdate: async (args: { boardId: string; action: string; userId: string }) => {
    broadcasts.push(args);
  },
}));

// Mock db (not used by expiryJob directly — broadcastPresenceUpdate is mocked)
mock.module('../../../common/db', () => ({ db: () => {} }));

describe('runExpiryCheck', () => {
  beforeEach(() => {
    broadcasts.length = 0;
  });

  it('broadcasts join when a user appears in presence cache', async () => {
    cacheKeys['board-1'] = ['presence:board-1:user-42'];
    setActiveBoardIds(() => new Set(['board-1']));

    await runExpiryCheck();

    expect(broadcasts).toContainEqual({ boardId: 'board-1', action: 'join', userId: 'user-42' });
  });

  it('broadcasts leave when a user disappears from presence cache', async () => {
    // First run — user is present
    cacheKeys['board-2'] = ['presence:board-2:user-99'];
    setActiveBoardIds(() => new Set(['board-2']));
    await runExpiryCheck();
    broadcasts.length = 0;

    // Second run — user expired (key gone)
    cacheKeys['board-2'] = [];
    await runExpiryCheck();

    expect(broadcasts).toContainEqual({ boardId: 'board-2', action: 'leave', userId: 'user-99' });
  });

  it('does not broadcast if presence is unchanged', async () => {
    cacheKeys['board-3'] = ['presence:board-3:user-1'];
    setActiveBoardIds(() => new Set(['board-3']));
    await runExpiryCheck(); // first run seeds knownPresence
    broadcasts.length = 0;

    await runExpiryCheck(); // second run — no change
    expect(broadcasts).toHaveLength(0);
  });
});
