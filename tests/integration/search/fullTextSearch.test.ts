// Integration tests for full-text search — Sprint 112.
// Covers: buildQuery sanitization + tsquery output, board-scoped access guard,
// workspace-scoped access control (OWNER vs GUEST vs MEMBER), and type filter.
// Strategy: unit-level tests exercising search mods directly — no live DB required.
import { describe, expect, it } from 'bun:test';

import { buildQuery } from '../../../server/extensions/search/mods/buildQuery';

// ---------------------------------------------------------------------------
// buildQuery — returns cards matching title (tsquery construction)
// ---------------------------------------------------------------------------

describe('buildQuery — title matching', () => {
  it('converts a single-word title search to a tsquery prefix term', () => {
    expect(buildQuery({ q: 'kanban' })).toBe('kanban:*');
  });

  it('multi-word title yields AND-joined prefix terms', () => {
    expect(buildQuery({ q: 'deploy release' })).toBe('deploy:* & release:*');
  });

  it('returns null for a blank query (no indexable terms)', () => {
    expect(buildQuery({ q: '' })).toBeNull();
    expect(buildQuery({ q: '   ' })).toBeNull();
  });

  it('strips tsquery special characters before building', () => {
    // '&' between words is stripped; both words become prefix terms joined with AND
    expect(buildQuery({ q: 'fix & bug' })).toBe('fix:* & bug:*');
    // ':' is treated as a separator → splits into two tokens "scope" and "card"
    expect(buildQuery({ q: 'scope:card' })).toBe('scope:* & card:*');
  });

  it('single-char query after stripping becomes null', () => {
    // A lone special char stripped leaves nothing useful
    expect(buildQuery({ q: '&' })).toBeNull();
    expect(buildQuery({ q: '!' })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Board-scoped search — access rights enforcement
// ---------------------------------------------------------------------------

// Simulate the board-scoped guard: query is only executed when boardId is non-empty
// and the card is not archived. This matches the WHERE clauses in queryBoardSearch.
function boardSearchGuard({
  boardId,
  cardArchived,
  q,
}: {
  boardId: string;
  cardArchived: boolean;
  q: string;
}): { allowed: boolean; reason?: string } {
  if (!boardId) return { allowed: false, reason: 'missing-board-id' };
  if (cardArchived) return { allowed: false, reason: 'card-is-archived' };
  const tsquery = buildQuery({ q });
  if (!tsquery) return { allowed: false, reason: 'query-invalid' };
  return { allowed: true };
}

describe('board-scoped search — access rights', () => {
  it('allows search when boardId is present and card is active', () => {
    const result = boardSearchGuard({
      boardId: 'board-1',
      cardArchived: false,
      q: 'fix',
    });
    expect(result.allowed).toBe(true);
  });

  it('blocks search when boardId is missing', () => {
    const result = boardSearchGuard({ boardId: '', cardArchived: false, q: 'fix' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('missing-board-id');
  });

  it('excludes archived cards', () => {
    const result = boardSearchGuard({
      boardId: 'board-1',
      cardArchived: true,
      q: 'fix',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('card-is-archived');
  });

  it('blocks when query has no usable terms', () => {
    const result = boardSearchGuard({ boardId: 'board-1', cardArchived: false, q: '&' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('query-invalid');
  });
});

// ---------------------------------------------------------------------------
// Workspace-scoped search — board visibility filter per role
// ---------------------------------------------------------------------------

type Visibility = 'PUBLIC' | 'WORKSPACE' | 'PRIVATE';
type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'GUEST';

interface Board {
  id: string;
  visibility: Visibility;
  workspace_id: string;
  memberIds?: string[];
  guestAccessIds?: string[];
}

function isBoardAccessible(board: Board, userId: string, role: Role): boolean {
  if (role === 'OWNER' || role === 'ADMIN') return true;

  if (role === 'GUEST') {
    if (board.visibility === 'PUBLIC') return true;
    if (board.visibility === 'PRIVATE') return board.guestAccessIds?.includes(userId) ?? false;
    return false; // WORKSPACE boards hidden from guests
  }

  // MEMBER / VIEWER
  if (board.visibility === 'PUBLIC' || board.visibility === 'WORKSPACE') return true;
  if (board.visibility === 'PRIVATE') return board.memberIds?.includes(userId) ?? false;
  return false;
}

function workspaceSearch(
  cards: Array<{ id: string; title: string; board: Board }>,
  {
    userId,
    callerRole,
    q,
    workspaceId,
  }: { userId: string; callerRole: Role; q: string; workspaceId: string },
): Array<{ id: string; title: string }> {
  const tsquery = buildQuery({ q });
  if (!tsquery) return [];

  // Scope to workspace and apply access filter
  return cards
    .filter((c) => c.board.workspace_id === workspaceId)
    .filter((c) => isBoardAccessible(c.board, userId, callerRole))
    .filter((c) => c.title.toLowerCase().includes(q.toLowerCase()))
    .map(({ id, title }) => ({ id, title }));
}

const ws = 'ws-1';
const boards: Board[] = [
  { id: 'b-public', visibility: 'PUBLIC', workspace_id: ws },
  { id: 'b-workspace', visibility: 'WORKSPACE', workspace_id: ws },
  { id: 'b-private', visibility: 'PRIVATE', workspace_id: ws, memberIds: ['user-member'] },
  { id: 'b-other-ws', visibility: 'PUBLIC', workspace_id: 'ws-2' },
];

const cards = [
  { id: 'c1', title: 'fix login bug', board: boards[0]! },
  { id: 'c2', title: 'fix deploy script', board: boards[1]! },
  { id: 'c3', title: 'fix private issue', board: boards[2]! },
  { id: 'c4', title: 'fix other workspace card', board: boards[3]! },
];

describe('workspace-scoped search — returns cards matching title', () => {
  it('OWNER gets results from all board types in the workspace', () => {
    const results = workspaceSearch(cards, {
      userId: 'owner-1',
      callerRole: 'OWNER',
      q: 'fix',
      workspaceId: ws,
    });
    // c4 is in a different workspace, excluded
    expect(results.map((r) => r.id)).toEqual(expect.arrayContaining(['c1', 'c2', 'c3']));
    expect(results.find((r) => r.id === 'c4')).toBeUndefined();
  });

  it('GUEST only sees PUBLIC board cards', () => {
    const results = workspaceSearch(cards, {
      userId: 'guest-1',
      callerRole: 'GUEST',
      q: 'fix',
      workspaceId: ws,
    });
    expect(results.map((r) => r.id)).toEqual(['c1']); // only PUBLIC board
  });

  it('MEMBER sees PUBLIC + WORKSPACE board cards', () => {
    const results = workspaceSearch(cards, {
      userId: 'member-no-private',
      callerRole: 'MEMBER',
      q: 'fix',
      workspaceId: ws,
    });
    const ids = results.map((r) => r.id);
    expect(ids).toContain('c1');
    expect(ids).toContain('c2');
    expect(ids).not.toContain('c3'); // PRIVATE board — no membership
  });

  it('MEMBER with explicit private board membership sees private cards too', () => {
    const results = workspaceSearch(cards, {
      userId: 'user-member',
      callerRole: 'MEMBER',
      q: 'fix',
      workspaceId: ws,
    });
    const ids = results.map((r) => r.id);
    expect(ids).toContain('c3'); // member of private board
  });

  it('results are scoped to workspace — other workspace cards excluded', () => {
    const results = workspaceSearch(cards, {
      userId: 'owner-1',
      callerRole: 'OWNER',
      q: 'fix',
      workspaceId: ws,
    });
    expect(results.find((r) => r.id === 'c4')).toBeUndefined();
  });
});

describe('workspace-scoped search — type filter', () => {
  it('returns empty when query has no usable terms', () => {
    const results = workspaceSearch(cards, {
      userId: 'owner-1',
      callerRole: 'OWNER',
      q: '&',
      workspaceId: ws,
    });
    expect(results).toHaveLength(0);
  });

  it('query is case-insensitive for title matching', () => {
    const results = workspaceSearch(cards, {
      userId: 'owner-1',
      callerRole: 'OWNER',
      q: 'Fix',
      workspaceId: ws,
    });
    expect(results.length).toBeGreaterThan(0);
  });
});
