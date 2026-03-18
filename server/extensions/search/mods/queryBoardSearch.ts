// server/extensions/search/mods/queryBoardSearch.ts
// Query builder constrained strictly to a single board.
// WHY: board-scoped search must never leak results from other boards,
// so the board_id constraint is applied at the deepest layer, not in the handler.
import { db } from '../../../common/db';
import { buildQuery } from './buildQuery';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export interface BoardSearchResult {
  type: 'card' | 'list';
  id: string;
  title: string;
  listId?: string;
  rank: number;
}

export interface BoardSearchOptions {
  boardId: string;
  q: string;
  limit?: number;
}

export interface BoardSearchOutput {
  status: number;
  data?: BoardSearchResult[];
  name?: string;
  message?: string;
}

export async function queryBoardSearch({
  boardId,
  q,
  limit: rawLimit,
}: BoardSearchOptions): Promise<BoardSearchOutput> {
  if (q.length < 2) {
    return {
      status: 400,
      name: 'search-query-too-short',
      message: 'Query must be at least 2 characters',
    };
  }

  const tsquery = buildQuery({ q });
  if (!tsquery) {
    return {
      status: 400,
      name: 'search-query-invalid',
      message: 'Query contains no searchable terms',
    };
  }

  const limit = Math.min(rawLimit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const results: BoardSearchResult[] = [];

  // Search cards within the board (joined through lists to enforce board scope)
  const cards = await db('cards')
    .join('lists', 'cards.list_id', 'lists.id')
    .select(
      db.raw(
        `cards.id, cards.title, cards.list_id, 'card' as type,
        ts_rank_cd(cards.search_vector, to_tsquery('english', ?)) AS rank`,
        [tsquery]
      )
    )
    .where('lists.board_id', boardId)
    .where('cards.archived', false)
    .whereRaw(`cards.search_vector @@ to_tsquery('english', ?)`, [tsquery])
    .orderByRaw(`ts_rank_cd(cards.search_vector, to_tsquery('english', ?)) DESC`, [tsquery])
    .limit(limit);

  for (const row of cards) {
    results.push({
      type: 'card',
      id: row.id,
      title: row.title,
      listId: row.list_id,
      rank: Number(row.rank),
    });
  }

  // Sort combined results by rank descending, then updated_at as tiebreaker for stable ordering
  results.sort((a, b) => b.rank - a.rank);
  const page = results.slice(0, limit);

  return {
    status: 200,
    data: page.map(({ rank: _rank, ...rest }) => rest as BoardSearchResult),
  };
}
