// GET /api/v1/boards/:boardId/health-checks
// Returns all active health checks for a board, each with its latest result embedded.
// Auth: board member (enforced by applyBoardVisibility before this handler is called).
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { applyBoardVisibility } from '../../../middlewares/boardVisibility';

export async function handleListHealthChecks(
  req: Request,
  boardId: string,
): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const visibilityError = await applyBoardVisibility(req, boardId);
  if (visibilityError) return visibilityError;

  // Load all active health checks for this board.
  const checks = await db('board_health_checks')
    .where({ board_id: boardId, is_active: true })
    .orderBy('created_at', 'asc');

  if (checks.length === 0) {
    return Response.json({ data: [] });
  }

  // Fetch the latest result for each health check in a single query using DISTINCT ON.
  const checkIds = checks.map((c: { id: string }) => c.id);
  const latestResults = await db('board_health_check_results')
    .whereIn('health_check_id', checkIds)
    .orderBy('health_check_id')
    .orderBy('checked_at', 'desc')
    // Use raw to emulate DISTINCT ON per health_check_id (works with PostgreSQL).
    .select(
      db.raw(
        'DISTINCT ON (health_check_id) health_check_id, status, http_status, response_time_ms, error_message, checked_at',
      ),
    );

  // Index latest results by health_check_id for O(1) lookup.
  const resultByCheckId = new Map<string, Record<string, unknown>>();
  for (const r of latestResults) {
    resultByCheckId.set(r.health_check_id, r);
  }

  const data = checks.map((c: Record<string, unknown>) => {
    const latest = resultByCheckId.get(c.id as string) ?? null;
    return {
      id: c.id,
      boardId: c.board_id,
      name: c.name,
      url: c.url,
      type: c.type,
      presetKey: c.preset_key ?? null,
      isActive: c.is_active,
      createdAt: c.created_at,
      latestResult: latest
        ? {
            status: latest.status,
            httpStatus: latest.http_status ?? null,
            responseTimeMs: latest.response_time_ms ?? null,
            errorMessage: latest.error_message ?? null,
            checkedAt: latest.checked_at,
          }
        : null,
    };
  });

  return Response.json({ data });
}
