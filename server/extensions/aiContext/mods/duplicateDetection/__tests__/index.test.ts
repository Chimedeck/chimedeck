import { describe, it, expect, vi } from 'vitest';
import { detectDuplicates } from '../index';
import type { DuplicateDB } from '../index';

const mockDB = (sourceCard: { id: string; title: string; description: string; board_id: string } | undefined, boardCards: { id: string; title: string; description: string; board_id: string }[]): DuplicateDB => ({
  querySourceCard: vi.fn().mockResolvedValue(sourceCard),
  queryBoardCards: vi.fn().mockResolvedValue(boardCards),
});

describe('detectDuplicates', () => {
  it('returns empty when source card not found', async () => {
    const db = mockDB(undefined, []);
    const result = await detectDuplicates({ cardId: 'c1', intent: 'test', db });
    expect(result).toEqual([]);
  });

  it('returns empty when no other cards in board', async () => {
    const db = mockDB(
      { id: 'c1', title: 'Test Card', description: 'A test', board_id: 'b1' },
      [],
    );
    const result = await detectDuplicates({ cardId: 'c1', intent: 'test', db });
    expect(result).toEqual([]);
  });

  it('detects duplicate by shared keywords', async () => {
    // [why] Use highly overlapping titles to ensure Jaccard > 0.4 threshold.
    const db = mockDB(
      { id: 'c1', title: 'Build authentication system with OAuth', description: 'Implement login flow', board_id: 'b1' },
      [
        { id: 'c2', title: 'Authentication with OAuth login', description: 'Build the auth system', board_id: 'b1' },
      ],
    );
    const result = await detectDuplicates({ cardId: 'c1', intent: 'auth', db });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].cardId).toBe('c2');
    expect(result[0].similarityScore).toBeGreaterThan(0);
  });

  it('does not flag unrelated cards', async () => {
    const db = mockDB(
      { id: 'c1', title: 'Build authentication system', description: 'Implement login', board_id: 'b1' },
      [
        { id: 'c2', title: 'Fix CSS layout', description: 'Adjust padding on header', board_id: 'b1' },
      ],
    );
    const result = await detectDuplicates({ cardId: 'c1', intent: 'auth', db });
    expect(result).toEqual([]);
  });

  it('returns empty when source card has no content', async () => {
    const db = mockDB(
      { id: 'c1', title: 'ab', description: '', board_id: 'b1' },
      [{ id: 'c2', title: 'Something else', description: 'whatever', board_id: 'b1' }],
    );
    const result = await detectDuplicates({ cardId: 'c1', intent: '', db });
    expect(result).toEqual([]);
  });

  it('caps results at connector limit', async () => {
    const cards = Array.from({ length: 20 }, (_, i) => ({
      id: `c${i + 2}`,
      title: `Authentication system v${i}`,
      description: 'OAuth implementation details',
      board_id: 'b1',
    }));
    const db = mockDB(
      { id: 'c1', title: 'Build authentication system', description: 'OAuth core', board_id: 'b1' },
      cards,
    );
    const result = await detectDuplicates({ cardId: 'c1', intent: 'auth', db });
    expect(result.length).toBeLessThanOrEqual(10);
  });
});
