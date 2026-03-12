// GET /api/v1/boards/:boardId/automations/:automationId/runs
// Returns paginated run log for a single automation.
// Query params: page (default 1), perPage (default 20, max 50), status (SUCCESS|PARTIAL|FAILED).

import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { requireWorkspaceMembership } from '../../../middlewares/permissionManager';
import { automationConfig } from '../config';

const MAX_PER_PAGE = 50;
const DEFAULT_PER_PAGE = 20;

export async function handleGetAutomationRuns(
  req: Request,
  boardId: string,
  automationId: string,
): Promise<Response> {
  if (!automationConfig.enabled) {
    return Response.json({ error: { name: 'feature-disabled' } }, { status: 404 });
  }

  // Auth always required for automation data — authenticate before board lookup.
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const board = await db('boards').where({ id: boardId }).first();
  if (!board) {
    return Response.json({ error: { name: 'board-not-found' } }, { status: 404 });
  }

  // Guests have board-scoped access; workspace members have workspace-wide access.
  // Require at least workspace membership (VIEWER+) or guest role for this board.
  const membershipError = await requireWorkspaceMembership(
    req as AuthenticatedRequest,
    board.workspace_id,
  );
  if (membershipError) {
    // Fall back: check if the caller is a guest on this board.
    const currentUser = (req as AuthenticatedRequest).currentUser!;
    const guest = await db('board_guests').where({ board_id: boardId, user_id: currentUser.id }).first().catch(() => null);
    if (!guest) return membershipError;
  }

  // Verify automation belongs to this board.
  const automation = await db('automations').where({ id: automationId, board_id: boardId }).first();
  if (!automation) {
    return Response.json({ error: { name: 'automation-not-found' } }, { status: 404 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const rawPerPage = parseInt(url.searchParams.get('perPage') ?? String(DEFAULT_PER_PAGE), 10);
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, rawPerPage || DEFAULT_PER_PAGE));
  const statusFilter = url.searchParams.get('status');

  const validStatuses = ['SUCCESS', 'PARTIAL', 'FAILED'];

  let query = db('automation_run_log as r')
    .where('r.automation_id', automationId)
    .orderBy('r.ran_at', 'desc');

  if (statusFilter && validStatuses.includes(statusFilter)) {
    query = query.where('r.status', statusFilter);
  }

  const [{ count }] = await db('automation_run_log as r')
    .where('r.automation_id', automationId)
    .modify((q) => {
      if (statusFilter && validStatuses.includes(statusFilter)) {
        q.where('r.status', statusFilter);
      }
    })
    .count('r.id as count');

  const totalCount = parseInt(String(count), 10);
  const totalPage = Math.ceil(totalCount / perPage);

  const rows = await query
    .limit(perPage)
    .offset((page - 1) * perPage)
    .leftJoin('users as u', 'r.triggered_by_user_id', 'u.id')
    .leftJoin('cards as c', 'r.card_id', 'c.id')
    .select(
      'r.id',
      'r.status',
      'r.card_id as cardId',
      'c.name as cardName',
      'r.triggered_by_user_id as triggeredByUserId',
      'u.name as triggeredByUserName',
      'r.ran_at as ranAt',
      'r.context',
      'r.error_message as errorMessage',
    );

  const data = rows.map((row: Record<string, unknown>) => ({
    id: row.id,
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
