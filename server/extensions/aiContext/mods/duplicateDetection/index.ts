// Duplicate detection — finds cards with semantically similar intent.
// [why] Prevents redundant AI generation by detecting when a new card
// overlaps heavily with existing cards in the same board.

import { db } from '../../../../common/db';
import { MAX_CHUNKS_PER_CONNECTOR } from '../../common/config';
import type { DuplicateCard } from '../../types';

/** Minimum similarity threshold for flagging a card as a possible duplicate. */
const DUPLICATE_THRESHOLD = 0.4;

/** DB interface for testability. */
export interface DuplicateDB {
  querySourceCard: (cardId: string) => Promise<CardRow | undefined>;
  queryBoardCards: (boardId: string, excludeCardId: string) => Promise<CardRow[]>;
}

interface CardRow {
  id: string;
  title: string;
  description: string | null;
  board_id: string;
}

export const liveDuplicateDB: DuplicateDB = {
  querySourceCard: async (cardId: string) => {
    return db('cards')
      .select('id', 'title', 'description', 'board_id')
      .where({ id: cardId })
      .first<CardRow>();
  },
  queryBoardCards: async (boardId: string, excludeCardId: string) => {
    return db('cards')
      .select('id', 'title', 'description', 'board_id')
      .where('board_id', boardId)
      .whereNot('id', excludeCardId)
      .whereNotNull('description')
      .limit(100) as unknown as CardRow[];
  },
};

/**
 * Compute Jaccard similarity between two sets of significant words.
 * [why] Jaccard is interpretable and fast — no embedding model needed.
 */
function jaccardSimilarity(wordsA: Set<string>, wordsB: Set<string>): number {
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Extract significant words from text for comparison.
 */
function extractWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 30)
  );
}

/**
 * Detect cards in the same board that are semantically similar to the source.
 */
export async function detectDuplicates({
  cardId,
  intent,
  db: dbOverride,
}: {
  cardId: string;
  intent: string;
  db?: DuplicateDB;
}): Promise<DuplicateCard[]> {
  const dbInstance = dbOverride ?? liveDuplicateDB;

  const sourceCard = await dbInstance.querySourceCard(cardId);
  if (!sourceCard) return [];

  const sourceText = [sourceCard.title, sourceCard.description ?? '', intent]
    .filter(Boolean)
    .join(' ');
  const sourceWords = extractWords(sourceText);

  if (sourceWords.size === 0) return [];

  const boardCards = await dbInstance.queryBoardCards(sourceCard.board_id, cardId);
  const duplicates: DuplicateCard[] = [];

  for (const card of boardCards) {
    const cardText = [card.title, card.description ?? ''].filter(Boolean).join(' ');
    const cardWords = extractWords(cardText);
    const similarity = jaccardSimilarity(sourceWords, cardWords);

    if (similarity >= DUPLICATE_THRESHOLD) {
      const overlapWords = [...sourceWords].filter((w) => cardWords.has(w));
      duplicates.push({
        cardId: card.id,
        cardTitle: card.title,
        similarityScore: Math.round(similarity * 100) / 100,
        reason:
          overlapWords.length > 0
            ? `Similar keywords: ${overlapWords.slice(0, 5).join(', ')}`
            : 'Similar intent detected',
      });
    }

    if (duplicates.length >= MAX_CHUNKS_PER_CONNECTOR) break;
  }

  duplicates.sort((a, b) => b.similarityScore - a.similarityScore);

  return duplicates;
}

export const duplicateDetectionDeps = {
  detectDuplicates,
  extractWords,
};
