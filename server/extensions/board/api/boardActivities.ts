// GET /api/v1/boards/:id/activities — merged, chronologically-sorted timeline of activity
// events and comments for a board. Both sources are fetched in parallel, merged in memory, and
// returned as a single paginated list sorted by created_at DESC.
// Cursor encodes { created_at, id } so both sub-queries can apply the same boundary.
import { db } from '../../../common/db';
import { requireWorkspaceMembership } from '../../../middlewares/permissionManager';
import {
  applyBoardVisibility,
  type BoardVisibilityScopedRequest,
} from '../../../middlewares/boardVisibility';
import { VISIBLE_EVENT_TYPES } from '../../activity/config/visibleEventTypes';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

interface CursorPayload {
  created_at: string;
  id: string;
}

function encodeCursor(created_at: string | Date, id: string): string {
  const iso = typeof created_at === 'string' ? created_at : (created_at as Date).toISOString();
  return Buffer.from(JSON.stringify({ created_at: iso, id })).toString('base64');
}

function decodeCursor(raw: string): CursorPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as unknown;
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'created_at' in parsed &&
      'id' in parsed &&
      typeof (parsed as Record<string, unknown>).created_at === 'string' &&
      typeof (parsed as Record<string, unknown>).id === 'string'
    ) {
      return parsed as CursorPayload;
    }
    return null;
  } catch {
    return null;
  }
}

type ActivityRow = {
  id: string;
  created_at: string | Date;
  entity_type: string;
  entity_id: string;
  board_id: string | null;
  action: string;
  actor_id: string;
  payload: Record<string, unknown> | string | null;
  actor_name?: string | null;
};

type CommentRow = {
  id: string;
  created_at: string | Date;
  card_id: string;
  user_id: string;
  content: string;
  version: number;
  deleted: boolean;
  updated_at: string | Date;
  author_name?: string | null;
  author_email?: string | null;
  card_title?: string | null;
};

// Comment actions are excluded because comments are already returned as their own
// `kind: 'comment'` entries from the comments table — including both would duplicate them.
const COMMENT_ACTIONS = new Set(['comment_added', 'comment_edited', 'comment_deleted']);
const NON_COMMENT_EVENT_TYPES = VISIBLE_EVENT_TYPES.filter((t) => !COMMENT_ACTIONS.has(t));

export async function handleGetBoardActivities(req: Request, boardId: string): Promise<Response> {
  const visibilityError = await applyBoardVisibility(req, boardId);
  if (visibilityError) return visibilityError;

  const scopedReq = req as BoardVisibilityScopedRequest;
  const board = scopedReq.board;
  if (!board) {
    return Response.json({ error: { name: 'board-not-found' } }, { status: 404 });
  }

  if (board.visibility !== 'PUBLIC') {
    const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
    if (membershipError) return membershipError;
  }

  const url = new URL(req.url);
  const cursorParam = url.searchParams.get('cursor') ?? null;
  const limitParam = Number.parseInt(url.searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);
  const limit = Math.min(
    Number.isNaN(limitParam) || limitParam < 1 ? DEFAULT_LIMIT : limitParam,
    MAX_LIMIT,
  );

  const cursor = cursorParam ? decodeCursor(cursorParam) : null;

  // Fetch activities and comments in parallel, each filtered to items before the cursor.
  // [why] Two separate queries keep existing query builder patterns and are easier to maintain
  //       than a raw UNION with cross-type casts.
  let activityQuery = db('activities as a')
    .leftJoin('users as u', 'a.actor_id', 'u.id')
    .where('a.board_id', boardId)
    .whereIn('a.action', NON_COMMENT_EVENT_TYPES)
    .orderBy('a.created_at', 'desc')
    .orderBy('a.id', 'desc')
    .limit(limit)
    .select(
      'a.id',
      'a.created_at',
      'a.entity_type',
      'a.entity_id',
      'a.board_id',
      'a.action',
      'a.actor_id',
      'a.payload',
      'u.name as actor_name',
    );

  let commentQuery = db('comments as c')
    .join('cards', 'c.card_id', 'cards.id')
    .join('lists', 'cards.list_id', 'lists.id')
    .leftJoin('users as u', 'c.user_id', 'u.id')
    .where('lists.board_id', boardId)
    .orderBy('c.created_at', 'desc')
    .orderBy('c.id', 'desc')
    .limit(limit)
    .select(
      'c.id',
      'c.created_at',
      'c.card_id',
      'c.user_id',
      'c.content',
      'c.version',
      'c.deleted',
      'c.updated_at',
      db.raw("COALESCE(u.name, u.email) as author_name"),
      'u.email as author_email',
      'cards.title as card_title',
    );

  if (cursor) {
    // Apply the same boundary to both queries: items strictly before the cursor timestamp,
    // or same timestamp with a lexicographically smaller id.
    activityQuery = activityQuery.where(function () {
      this.where('a.created_at', '<', cursor.created_at).orWhere(function () {
        this.where('a.created_at', '=', cursor.created_at).andWhere('a.id', '<', cursor.id);
      });
    });
    commentQuery = commentQuery.where(function () {
      this.where('c.created_at', '<', cursor.created_at).orWhere(function () {
        this.where('c.created_at', '=', cursor.created_at).andWhere('c.id', '<', cursor.id);
      });
    });
  }

  const [activityRows, commentRows] = await Promise.all([activityQuery, commentQuery]) as [
    ActivityRow[],
    CommentRow[],
  ];

  // Merge and sort combined results newest-first.
  type Item =
    | { kind: 'activity'; data: ActivityRow; _ts: number }
    | { kind: 'comment'; data: CommentRow; _ts: number };

  const merged: Item[] = [
    ...activityRows.map((a): Item => ({ kind: 'activity', data: a, _ts: new Date(a.created_at).getTime() })),
    ...commentRows.map((c): Item => ({ kind: 'comment', data: c, _ts: new Date(c.created_at).getTime() })),
  ].sort((x, y) => {
    if (y._ts !== x._ts) return y._ts - x._ts;
    // Tie-break by id descending for stable ordering
    return y.data.id < x.data.id ? -1 : 1;
  });

  const hasMore = merged.length > limit;
  const page = hasMore ? merged.slice(0, limit) : merged;

  const lastItem = page.at(-1) ?? null;
  const nextCursor = hasMore && lastItem
    ? encodeCursor(lastItem.data.created_at, lastItem.data.id)
    : null;

  // Strip internal sort key before returning
  const data = page.map(({ kind, data }) => ({ kind, data }));

  return Response.json({ data, metadata: { cursor: nextCursor, hasMore } });
}
