// GET /api/v1/boards/:id/activity — paginated board activity feed.
// PUBLIC boards: no auth required. WORKSPACE/PRIVATE: min role VIEWER.
import { db } from '../../../common/db';
import {
  requireRole,
} from '../../../middlewares/permissionManager';
import {
  applyBoardVisibility,
  type BoardVisibilityScopedRequest,
} from '../../../middlewares/boardVisibility';
import { VISIBLE_EVENT_TYPES } from '../config/visibleEventTypes';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function handleBoardActivity(req: Request, boardId: string): Promise<Response> {
  const visibilityError = await applyBoardVisibility(req, boardId);
  if (visibilityError) return visibilityError;

  const scopedReq = req as BoardVisibilityScopedRequest;
  const board = scopedReq.board!;

  if (board.visibility !== 'PUBLIC') {
    const roleError = requireRole(scopedReq, 'VIEWER');
    if (roleError) return roleError;
  }

  const url = new URL(req.url);
  const cursor = url.searchParams.get('cursor') ?? null;
  const limitParam = parseInt(url.searchParams.get('limit') ?? `${DEFAULT_LIMIT}`, 10);
  const limit = Math.min(isNaN(limitParam) || limitParam < 1 ? DEFAULT_LIMIT : limitParam, MAX_LIMIT);

  let query = db('activities')
    .where({ board_id: boardId })
    .whereIn('action', VISIBLE_EVENT_TYPES)
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')
    .limit(limit + 1); // fetch one extra to determine hasMore

  if (cursor) {
    const cursorRow = await db('activities').where({ id: cursor }).first();
    if (cursorRow) {
      query = query.where(function () {
        this.where('created_at', '<', cursorRow.created_at).orWhere(function () {
          this.where('created_at', '=', cursorRow.created_at).andWhere('id', '<', cursor);
        });
      });
    }
  }

  const rows = await query;
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore && data.length > 0 ? (data[data.length - 1] as { id: string }).id : null;

  return Response.json({
    data,
    metadata: { cursor: nextCursor, hasMore },
  });
}
