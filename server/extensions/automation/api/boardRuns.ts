// GET /api/v1/boards/:boardId/automation-runs
// Returns the last 200 runs across all automations on the board, sorted by ran_at desc.
// Supports pagination (default perPage 50, max 50).

import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { requireWorkspaceMembership } from '../../../middlewares/permissionManager';
import { automationConfig } from '../config';

const BOARD_RUN_CAP = 200;
const DEFAULT_PER_PAGE = 50;

export async function handleGetBoardRuns(req: Request, boardId: string): Promise<Response> {
  if (!automationConfig.enabled) {
    return Response.json({ error: { name: 'feature-disabled' } }, { status: 404 });
  }

  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const board = await db('boards').where({ id: boardId }).first();
  if (!board) {
    return Response.json({ error: { name: 'board-not-found' } }, { status: 404 });
  }

  const membershipError = await requireWorkspaceMembership(
    req as AuthenticatedRequest,
    board.workspace_id,
  );
  if (membershipError) {
    const currentUser = (req as AuthenticatedRequest).currentUser!;
    const guest = await db('board_guests').where({ board_id: boardId, user_id: currentUser.id }).first().catch(() => null);
    if (!guest) return membershipError;
  }

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const perPage = DEFAULT_PER_PAGE;

  // Fetch last 200 runs across all automations for this board, then paginate in memory.
  // Using a subquery to enforce the 200-row cap before pagination.
  const recentRuns = db('automation_run_log as r')
    .join('automations as a', 'r.automation_id', 'a.id')
    .where('a.board_id', boardId)
    .orderBy('r.ran_at', 'desc')
    .limit(BOARD_RUN_CAP)
    .leftJoin('users as u', 'r.triggered_by_user_id', 'u.id')
    .leftJoin('cards as c', 'r.card_id', 'c.id')
    .select(
      'r.id',
      'r.automation_id as automationId',
      'a.name as automationName',
      'a.automation_type as automationType',
      'r.status',
      'r.card_id as cardId',
      'c.title as cardName',
      'r.triggered_by_user_id as triggeredByUserId',
      'u.name as triggeredByUserName',
      'r.ran_at as ranAt',
      'r.context',
      'r.error_message as errorMessage',
    );

  const allRows = await recentRuns;

  const totalCount = allRows.length;
  const totalPage = Math.ceil(totalCount / perPage);
  const pageRows = allRows.slice((page - 1) * perPage, page * perPage);

  const data = pageRows.map((row: Record<string, unknown>) => ({
    id: row.id,
    automationId: row.automationId,
    automationName: row.automationName,
    automationType: row.automationType,
    status: row.status,
    cardId: row.cardId ?? null,
    cardName: row.cardName ?? null,
    triggeredByUser:
      row.triggeredByUserId
        ? { id: row.triggeredByUserId, name: row.triggeredByUserName ?? null }
        : null,
    ranAt: row.ranAt,
    context: typeof row.context === 'string' ? JSON.parse(row.context) : (row.context ?? {}),
    errorMessage: row.errorMessage ?? null,
  }));

  return Response.json({ data, metadata: { totalPage, perPage } });
}
