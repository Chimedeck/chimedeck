// Cards search connector — queries the DB for historically related cards.
// [why] Cards with similar titles or descriptions in the same board often
// represent related work that the AI should consider.

import { db } from '../../../../common/db';

import type { SearchConnectorResult } from '../../types';
import { MAX_CHUNKS_PER_CONNECTOR, CARD_SIMILARITY_THRESHOLD } from '../../common/config';

/** DB operations — injected for testability. */
export interface CardsDB {
  querySourceCard: (cardId: string) => Promise<CardRow | undefined>;
  querySimilarCards: (
    boardId: string,
    excludeCardId: string,
    words: string[],
    limit: number
  ) => Promise<CardRow[]>;
}

/** Production implementation using Knex. */
export const liveCardsDB: CardsDB = {
  querySourceCard: async (cardId: string) => {
    return db('cards')
      .select('id', 'title', 'description', 'board_id', 'list_id')
      .where({ id: cardId })
      .first<CardRow>();
  },
  querySimilarCards: async (
    boardId: string,
    excludeCardId: string,
    words: string[],
    limit: number
  ) => {
    const query = db('cards')
      .select('id', 'title', 'description', 'board_id', 'list_id')
      .where('board_id', boardId)
      .whereNot('id', excludeCardId)
      .where(function () {
        for (const word of words) {
          void this.orWhere('title', 'ILIKE', `%${word}%`);
        }
        for (const word of words) {
          void this.orWhere('description', 'ILIKE', `%${word}%`);
        }
      })
      .limit(limit);

    return query as unknown as CardRow[];
  },
};

interface CardRow {
  id: string;
  title: string;
  description: string | null;
  board_id: string;
  list_id: string;
}

/**
 * Compute a simple word-overlap similarity between two strings.
 * Returns 0-1 score.
 */
function wordSimilarity(a: string, b: string): number {
  const wordsA = new Set(
    a
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
  const wordsB = new Set(
    b
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  return intersection / Math.max(wordsA.size, wordsB.size);
}

/**
 * Search the DB for cards related to the given card.
 * [why] Uses ILIKE on title and description to find semantically similar cards
 * in the same board, then scores by word overlap for precision.
 */
export async function searchCards({
  cardId,
  intent,
  db = liveCardsDB,
}: {
  cardId: string;
  intent: string;
  db?: CardsDB;
}): Promise<SearchConnectorResult[]> {
  // Look up the source card for its title, description, and board context.
  const sourceCard = await db.querySourceCard(cardId);

  if (!sourceCard) return [];

  // [why] Combine card text with user intent for richer search.
  const sourceText = [sourceCard.title, sourceCard.description ?? '', intent]
    .filter(Boolean)
    .join(' ');

  // [why] Extract significant words (3+ chars) for ILIKE patterns.
  const significantWords = sourceText
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 10);

  if (significantWords.length === 0) return [];

  // [why] Find similar cards by significant words in the same board.
  const rows = await db.querySimilarCards(
    sourceCard.board_id,
    cardId,
    significantWords,
    MAX_CHUNKS_PER_CONNECTOR * 2
  );

  const results: SearchConnectorResult[] = [];

  for (const row of rows) {
    const rowText = [row.title, row.description ?? ''].filter(Boolean).join(' ');
    const similarity = wordSimilarity(sourceText, rowText);

    // [why] Only include cards above the similarity threshold.
    if (similarity < CARD_SIMILARITY_THRESHOLD) continue;

    const snippet = row.description ? row.description.slice(0, 300) : row.title;

    results.push({
      source: 'cards',
      sourcePath: row.id,
      content: `Card "${row.title}": ${snippet}`,
      relevance: similarity,
      metadata: {
        cardId: row.id,
        cardTitle: row.title,
        boardId: row.board_id,
        listId: row.list_id,
      },
    });

    if (results.length >= MAX_CHUNKS_PER_CONNECTOR) break;
  }

  return results;
}

export const cardsSearchDeps = {
  searchCards,
};
