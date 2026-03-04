// GET /api/v1/boards/:id/activity — paginated board activity feed; min role: VIEWER.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { VISIBLE_EVENT_TYPES } from '../config/visibleEventTypes';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function handleBoardActivity(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const board = await db('boards').where({ id: boardId }).first();
  if (!board) {
    return Response.json(
      { name: 'board-not-found', data: { message: 'Board not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'VIEWER');
  if (roleError) return roleError;

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
