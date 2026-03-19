// GET /api/v1/boards/:boardId/automation-quota
// Returns the board's automation run usage for the current calendar month.
// Publishes a quota_warning WS event when usage crosses 80% (once per request — UI decides UI state).

import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { requireWorkspaceMembership } from '../../../middlewares/permissionManager';
import { automationConfig } from '../config';
import { broadcast } from '../../realtime/mods/rooms/broadcast';

export async function handleGetAutomationQuota(req: Request, boardId: string): Promise<Response> {
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

  const now = new Date();
  // Start of current calendar month in UTC.
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  // Start of next month = reset boundary.
  const resetAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  // Count runs for all automations on this board within the current calendar month.
  const [{ count }] = await db('automation_run_log as r')
    .join('automations as a', 'r.automation_id', 'a.id')
    .where('a.board_id', boardId)
    .where('r.ran_at', '>=', monthStart.toISOString())
    .count('r.id as count');

  const usedRuns = parseInt(String(count), 10);
  const maxRuns = automationConfig.monthlyQuota;
  const percentUsed = maxRuns > 0 ? Math.floor((usedRuns / maxRuns) * 100) : 0;

  // Publish quota_warning event when usage is at or above 80%.
  // Fire-and-forget — must not block or throw.
  if (percentUsed >= 80) {
    try {
      broadcast({
        boardId,
        message: JSON.stringify({
          type: 'quota_warning',
          payload: {
            boardId,
            usedRuns,
            maxRuns,
            percentUsed,
            exceeded: usedRuns > maxRuns,
          },
        }),
      });
    } catch {
      // WS publish failure is non-fatal.
    }
  }

  return Response.json({
    data: {
      usedRuns,
      maxRuns,
      resetAt: resetAt.toISOString(),
      percentUsed,
    },
  });
}
