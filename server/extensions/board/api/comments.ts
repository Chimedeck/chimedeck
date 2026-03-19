// GET /api/v1/boards/:id/comments — paginated comments across all cards in a board.
// PUBLIC boards: no auth required. WORKSPACE/PRIVATE: min role VIEWER.
import { db } from '../../../common/db';
import { requireWorkspaceMembership } from '../../../middlewares/permissionManager';
import {
  applyBoardVisibility,
  type BoardVisibilityScopedRequest,
} from '../../../middlewares/boardVisibility';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function handleGetBoardComments(req: Request, boardId: string): Promise<Response> {
  const visibilityError = await applyBoardVisibility(req, boardId);
  if (visibilityError) return visibilityError;

  const scopedReq = req as BoardVisibilityScopedRequest;
  const board = scopedReq.board!;

  if (board.visibility !== 'PUBLIC') {
    const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
    if (membershipError) return membershipError;
  }

  const url = new URL(req.url);
  const cursor = url.searchParams.get('cursor') ?? null;
  const limitParam = parseInt(url.searchParams.get('limit') ?? `${DEFAULT_LIMIT}`, 10);
  const limit = Math.min(
    isNaN(limitParam) || limitParam < 1 ? DEFAULT_LIMIT : limitParam,
    MAX_LIMIT
  );

  // Scope to cards that belong to lists in this board
  let query = db('comments as c')
    .join('cards', 'c.card_id', 'cards.id')
    .join('lists', 'cards.list_id', 'lists.id')
    .leftJoin('users', 'c.user_id', 'users.id')
    .where('lists.board_id', boardId)
    .orderBy('c.created_at', 'desc')
    .orderBy('c.id', 'desc')
    .limit(limit + 1)
    .select(
      'c.id',
      'c.card_id',
      'c.user_id',
      'c.content',
      'c.version',
      'c.deleted',
      'c.created_at',
      'c.updated_at',
      db.raw('COALESCE(users.name, users.email) as author_name'),
      'users.email as author_email',
      'cards.title as card_title'
    );

  if (cursor) {
    const cursorRow = await db('comments').where({ id: cursor }).first();
    if (cursorRow) {
      query = query.where(function () {
        this.where('c.created_at', '<', cursorRow.created_at).orWhere(function () {
          this.where('c.created_at', '=', cursorRow.created_at).andWhere('c.id', '<', cursor);
        });
      });
    }
  }

  const rows = await query;
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor =
    hasMore && data.length > 0 ? (data[data.length - 1] as { id: string }).id : null;

  return Response.json({
    data,
    metadata: { cursor: nextCursor, hasMore },
  });
}
