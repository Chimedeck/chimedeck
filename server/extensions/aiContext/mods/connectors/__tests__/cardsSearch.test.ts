// Tests for cardsSearch connector — DB card similarity search.
import { describe, it, expect, vi } from 'vitest';

const mockDb = vi.fn(() => ({}));

// [why] The cardsSearch module still imports common/db for the live DB implementation.
// Mock it before dynamic import to prevent transitive Bun.env access.
vi.mock('../../../../common/db', () => ({
  db: mockDb,
}));

// Pre-emptively mock env.ts to avoid Bun globals
vi.mock('../../../../../config/env', () => ({
  env: { DATABASE_URL: 'postgres://test:test@localhost:5432/test' },
}));

interface CardRow {
  id: string;
  title: string;
  description: string | null;
  board_id: string;
  list_id: string;
}

interface CardsDB {
  querySourceCard: (cardId: string) => Promise<CardRow | undefined>;
  querySimilarCards: (boardId: string, excludeCardId: string, words: string[], limit: number) => Promise<CardRow[]>;
}

describe('searchCards', () => {
  it('returns empty array when source card not found', async () => {
    const { searchCards } = await import('../cardsSearch');

    const mockCardsDB: CardsDB = {
      querySourceCard: async () => undefined,
      querySimilarCards: async () => [],
    };

    const results = await searchCards({
      cardId: 'nonexistent-card',
      intent: 'test',
      db: mockCardsDB,
    });

    expect(results).toEqual([]);
  });

  it('finds similar cards by title word overlap', async () => {
    const { searchCards } = await import('../cardsSearch');

    const sourceCard = {
      id: 'card-1',
      title: 'Build Authentication System',
      description: 'Implement JWT-based auth for the API',
      board_id: 'board-1',
      list_id: 'list-1',
    };

    const similarCards = [
      {
        id: 'card-2',
        title: 'Authentication System for Admin Panel',
        description: 'Admin panel needs its own auth flow',
        board_id: 'board-1',
        list_id: 'list-2',
      },
      {
        id: 'card-3',
        title: 'Completely Unrelated Feature',
        description: 'This has nothing to do with authentication',
        board_id: 'board-1',
        list_id: 'list-3',
      },
    ];

    const mockCardsDB: CardsDB = {
      querySourceCard: async () => sourceCard,
      querySimilarCards: async () => similarCards,
    };

    const results = await searchCards({
      cardId: 'card-1',
      intent: 'authentication',
      db: mockCardsDB,
    });

    expect(results.length).toBeGreaterThan(0);
    const titles = results.map(r => (r.metadata as { cardTitle?: string })?.cardTitle);
    const authMatches = titles.filter(t => t?.toLowerCase().includes('authentication'));
    expect(authMatches.length).toBeGreaterThan(0);
  });

  it('returns empty when card has no significant words', async () => {
    const { searchCards } = await import('../cardsSearch');

    const sourceCard = {
      id: 'card-1',
      title: 'A',
      description: null,
      board_id: 'board-1',
      list_id: 'list-1',
    };

    const mockCardsDB: CardsDB = {
      querySourceCard: async () => sourceCard,
      querySimilarCards: async () => [],
    };

    const results = await searchCards({
      cardId: 'card-1',
      intent: '',
      db: mockCardsDB,
    });

    expect(results).toEqual([]);
  });
});
