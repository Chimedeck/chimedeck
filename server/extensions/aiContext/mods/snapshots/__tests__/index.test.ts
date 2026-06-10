import { describe, it, expect, vi } from 'vitest';
import { persistSnapshot, computeHash } from '../index';
import type { SnapshotDB, SnapshotRecord } from '../index';
import type { ContextGatherResponse } from '../../../types';

function mockSnapshotDB(): SnapshotDB {
  const records: SnapshotRecord[] = [];
  return {
    insert: vi.fn().mockImplementation(async (snapshot) => {
      const id = `snap_test_${records.length}`;
      records.push({
        ...snapshot,
        id,
        createdAt: new Date(),
      });
      return id;
    }),
    findById: vi.fn().mockImplementation(async (id: string) => {
      return records.find(r => r.id === id);
    }),
    findByCardId: vi.fn().mockImplementation(async (cardId: string) => {
      return records.filter(r => r.cardId === cardId);
    }),
  };
}

const gatherResponse: ContextGatherResponse = {
  chunks: [
    {
      source: 'docs',
      sourcePath: 'specs/architecture/auth.md',
      content: 'Authentication system using OAuth.',
      confidence: 0.95,
    },
  ],
  sourceCounts: { docs: 1, code: 0, cards: 0, git: 0 },
  totalReturned: 1,
  timeouts: [],
};

describe('computeHash', () => {
  it('returns a consistent hash for the same input', async () => {
    const h1 = await computeHash('hello world');
    const h2 = await computeHash('hello world');
    expect(h1).toBe(h2);
    expect(h1.length).toBe(64); // SHA-256 hex is 64 chars
  });

  it('returns a different hash for different input', async () => {
    const h1 = await computeHash('hello world');
    const h2 = await computeHash('hello world!');
    expect(h1).not.toBe(h2);
  });
});

describe('persistSnapshot', () => {
  it('persists a snapshot and returns ID + hash', async () => {
    const db = mockSnapshotDB();
    const { snapshotId, snapshotHash } = await persistSnapshot({
      cardId: 'card-123',
      intent: 'Build authentication',
      gatherResponse,
      db,
    });

    expect(snapshotId).toBeTruthy();
    expect(snapshotId).toContain('snap_test_');
    expect(snapshotHash.length).toBe(64);
    expect(db.insert).toHaveBeenCalled();
  });

  it('persists with focusPaths', async () => {
    const db = mockSnapshotDB();
    await persistSnapshot({
      cardId: 'card-123',
      intent: 'Build auth',
      gatherResponse,
      focusPaths: ['specs/architecture/'],
      db,
    });

    const calls = (db.insert as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calls[0].focusPaths).toEqual(['specs/architecture/']);
  });

  it('persists with budget when present', async () => {
    const db = mockSnapshotDB();
    const responseWithBudget: ContextGatherResponse = {
      ...gatherResponse,
      budget: {
        totalTokens: 500,
        maxTokens: 8000,
        totalSizeBytes: 2000,
        maxSizeBytes: 100_000,
        exceeded: false,
        droppedChunks: 0,
      },
    };

    const { snapshotHash } = await persistSnapshot({
      cardId: 'card-123',
      intent: 'test',
      gatherResponse: responseWithBudget,
      db,
    });

    expect(snapshotHash.length).toBe(64);
  });

  it('produces consistent hash for identical chunks', async () => {
    const db1 = mockSnapshotDB();
    const db2 = mockSnapshotDB();

    const { snapshotHash: hash1 } = await persistSnapshot({
      cardId: 'card-123',
      intent: 'test',
      gatherResponse,
      db: db1,
    });

    const { snapshotHash: hash2 } = await persistSnapshot({
      cardId: 'card-456',
      intent: 'test',
      gatherResponse,
      db: db2,
    });

    expect(hash1).toBe(hash2); // Same chunks → same hash regardless of card
  });
});
