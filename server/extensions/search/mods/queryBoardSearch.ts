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
  short_id?: string;
  title: string;
  description?: string | null;
  listId?: string;
  due_date?: string | null;
  start_date?: string | null;
  created_at?: string;
  updated_at?: string;
  archived?: boolean;
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

const MATCH_ALL = '*';

export async function queryBoardSearch({
  boardId,
  q,
  limit: rawLimit,
}: BoardSearchOptions): Promise<BoardSearchOutput> {
  const isMatchAll = q === MATCH_ALL;

  if (!isMatchAll && q.length < 2) {
    return {
      status: 400,
      name: 'search-query-too-short',
      message: 'Query must be at least 2 characters',
    };
  }

  const tsquery = isMatchAll ? null : buildQuery({ q });
  if (!isMatchAll && !tsquery) {
    return {
      status: 400,
      name: 'search-query-invalid',
      message: 'Query contains no searchable terms',
    };
  }

  const limit = Math.min(rawLimit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const results: BoardSearchResult[] = [];

  if (isMatchAll) {
    // [why] * wildcard returns all non-archived cards in the board without full-text filtering.
    // Sort by updated_at descending so the most recent cards appear first.
    const cards = await db('cards')
      .join('lists', 'cards.list_id', 'lists.id')
      .select(
        'cards.id',
        'cards.short_id',
        'cards.title',
        'cards.description',
        'cards.list_id',
        'cards.due_date',
        'cards.start_date',
        'cards.created_at',
        'cards.updated_at',
        'cards.archived'
      )
      .where('lists.board_id', boardId)
      .where('cards.archived', false)
      .orderBy('cards.updated_at', 'desc')
      .limit(limit);

    for (const row of cards) {
      results.push({
        type: 'card',
        id: row.id,
        short_id: row.short_id,
        title: row.title,
        description: row.description,
        listId: row.list_id,
        due_date: row.due_date,
        start_date: row.start_date,
        created_at: row.created_at,
        updated_at: row.updated_at,
        archived: row.archived,
        rank: 0,
      });
    }

    return {
      status: 200,
      data: results.map(({ rank: _rank, ...rest }) => rest as BoardSearchResult),
    };
  }

  // Search cards within the board (joined through lists to enforce board scope)
  const cards = await db('cards')
    .join('lists', 'cards.list_id', 'lists.id')
    .select(
      db.raw(
        `cards.id, cards.short_id, cards.title, cards.description, cards.list_id,
        cards.due_date, cards.start_date, cards.created_at, cards.updated_at, cards.archived,
        'card' as type,
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
      short_id: row.short_id,
      title: row.title,
      description: row.description,
      listId: row.list_id,
      due_date: row.due_date,
      start_date: row.start_date,
      created_at: row.created_at,
      updated_at: row.updated_at,
      archived: row.archived,
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
