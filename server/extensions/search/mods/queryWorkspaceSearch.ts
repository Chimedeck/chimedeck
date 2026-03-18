// server/extensions/search/mods/queryWorkspaceSearch.ts
// Access-aware workspace search query builder.
//
// WHY: Workspace search must never expose boards or cards to callers who lack
// board-level access. Filtering is enforced at the SQL layer — not in the
// handler — so the permission boundary cannot be accidentally bypassed.
//
// Access matrix (mirrors boardVisibility middleware):
// | Role          | PUBLIC | WORKSPACE | PRIVATE (explicit member) |
// |---------------|--------|-----------|---------------------------|
// | OWNER / ADMIN | ✅     | ✅        | ✅ (always)               |
// | MEMBER/VIEWER | ✅     | ✅        | ✅ if in board_members    |
// | GUEST         | ✅     | ❌        | ✅ if in board_guest_access|
import { db } from '../../../common/db';
import { buildQuery } from './buildQuery';
import type { Role } from '../../../middlewares/permissionManager';
import { searchLog } from '../common/searchLogger';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface WorkspaceSearchOptions {
  workspaceId: string;
  userId: string;
  callerRole: Role;
  q: string;
  type?: 'board' | 'card' | null;
  cursor?: string | null;
  includeArchived?: boolean;
  limit?: number;
}

export interface WorkspaceSearchResult {
  id: string;
  title: string;
  type: 'board' | 'card';
  workspace_id?: string;
  board_id?: string;
  list_id?: string;
  state?: string;
  background?: string | null;
  archived?: boolean;
  rank: number;
}

export interface WorkspaceSearchOutput {
  status: number;
  data?: Omit<WorkspaceSearchResult, 'rank'>[];
  metadata?: { cursor: string | null; hasMore: boolean };
  name?: string;
  message?: string;
}

// Builds a Knex `.where` callback that restricts board rows to only those
// accessible by the caller. Called for both the board query and the card
// query (via a join to the boards table).
function applyBoardAccessFilter(
  qb: ReturnType<typeof db>,
  userId: string,
  callerRole: Role,
): void {
  if (callerRole === 'OWNER' || callerRole === 'ADMIN') {
    // Admins and owners can see every board — no extra clause needed.
    return;
  }

  if (callerRole === 'GUEST') {
    // Guests: PUBLIC boards, or PRIVATE boards with explicit guest access.
    // WORKSPACE boards are never accessible to guests.
    qb.where(function (inner) {
      inner
        .where('boards.visibility', 'PUBLIC')
        .orWhere(function (priv) {
          priv
            .where('boards.visibility', 'PRIVATE')
            .whereExists(function (sub) {
              sub
                .select(db.raw('1'))
                .from('board_guest_access')
                .whereRaw('board_guest_access.board_id = boards.id')
                .where('board_guest_access.user_id', userId);
            });
        });
    });
    return;
  }

  // MEMBER / VIEWER: PUBLIC + WORKSPACE + PRIVATE where they're in board_members.
  qb.where(function (inner) {
    inner
      .whereIn('boards.visibility', ['PUBLIC', 'WORKSPACE'])
      .orWhere(function (priv) {
        priv
          .where('boards.visibility', 'PRIVATE')
          .whereExists(function (sub) {
            sub
              .select(db.raw('1'))
              .from('board_members')
              .whereRaw('board_members.board_id = boards.id')
              .where('board_members.user_id', userId);
          });
      });
  });
}

export async function queryWorkspaceSearch({
  workspaceId,
  userId,
  callerRole,
  q,
  type,
  cursor,
  includeArchived = false,
  limit: rawLimit,
}: WorkspaceSearchOptions): Promise<WorkspaceSearchOutput> {
  if (q.length < 2) {
    return { status: 400, name: 'search-query-too-short', message: 'Query must be at least 2 characters' };
  }

  const tsquery = buildQuery({ q });
  if (!tsquery) {
    return { status: 400, name: 'search-query-invalid', message: 'Query contains no searchable terms' };
  }

  const limit = Math.min(rawLimit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const results: WorkspaceSearchResult[] = [];

  // Log the permission filter being applied so access control decisions are observable.
  searchLog.permissionFilterApplied({
    workspaceId,
    userId,
    callerRole,
    type: type ?? null,
    includeArchived: includeArchived ?? false,
  });

  // ── Board search ──────────────────────────────────────────────────────────
  if (!type || type === 'board') {
    const boardQ = db('boards')
      .select(
        db.raw(
          `boards.id, boards.title, boards.workspace_id, boards.state,
           boards.background, 'board' as type,
           ts_rank_cd(boards.search_vector, to_tsquery('english', ?)) AS rank`,
          [tsquery],
        ),
      )
      .where('boards.workspace_id', workspaceId)
      .whereRaw(`boards.search_vector @@ to_tsquery('english', ?)`, [tsquery]);

    if (!includeArchived) boardQ.where('boards.state', 'ACTIVE');
    if (cursor) boardQ.where('boards.id', '>', cursor);

    // Apply caller-specific board visibility filter
    applyBoardAccessFilter(boardQ, userId, callerRole);

    const boards = await boardQ.orderBy('rank', 'desc').limit(limit);
    results.push(...boards.map((b) => ({ ...b, type: 'board' as const, rank: Number(b.rank) })));
  }

  // ── Card search ───────────────────────────────────────────────────────────
  if (!type || type === 'card') {
    const cardQ = db('cards')
      .join('lists', 'cards.list_id', 'lists.id')
      .join('boards', 'lists.board_id', 'boards.id')
      .select(
        db.raw(
          `cards.id, cards.title, cards.list_id, boards.id as board_id,
           boards.workspace_id, cards.archived, 'card' as type,
           ts_rank_cd(cards.search_vector, to_tsquery('english', ?)) AS rank`,
          [tsquery],
        ),
      )
      .where('boards.workspace_id', workspaceId)
      .whereRaw(`cards.search_vector @@ to_tsquery('english', ?)`, [tsquery]);

    if (!includeArchived) cardQ.where('cards.archived', false);
    if (cursor) cardQ.where('cards.id', '>', cursor);

    // Apply the same board-level access filter (boards table is joined)
    applyBoardAccessFilter(cardQ, userId, callerRole);

    const cards = await cardQ.orderBy('rank', 'desc').limit(limit);
    results.push(...cards.map((c) => ({ ...c, type: 'card' as const, rank: Number(c.rank) })));
  }

  results.sort((a, b) => b.rank - a.rank);
  const page = results.slice(0, limit);
  const hasMore = results.length > limit;
  const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;

  return {
    status: 200,
    data: page.map(({ rank: _rank, ...rest }) => rest as Omit<WorkspaceSearchResult, 'rank'>),
    metadata: { cursor: nextCursor, hasMore },
  };
}
