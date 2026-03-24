// POST /api/v1/boards/:boardId/health-checks/probe-all
// Runs on-demand probes for every active health check on a board.
// Auth: board member. Rate limited to 1 probe-all per board per 5 seconds.
// Individual checks that are rate-limited at the per-check level are skipped
// (result omitted from response) to avoid blocking the entire batch.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { applyBoardVisibility } from '../../../middlewares/boardVisibility';
import { probe } from '../mods/probe';
import { checkRateLimit, retryAfterMs } from '../mods/rateLimiter';

export async function handleProbeAllHealthChecks(
  req: Request,
  boardId: string,
): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const visibilityError = await applyBoardVisibility(req, boardId);
  if (visibilityError) return visibilityError;

  // Board-level rate limit: 1 probe-all per board per 5 seconds.
  const boardRateLimitKey = `probe-all:${boardId}`;
  if (!checkRateLimit(boardRateLimitKey)) {
    const retryAfter = Math.ceil(retryAfterMs(boardRateLimitKey) / 1000);
    return Response.json(
      {
        name: 'rate-limit-exceeded',
        data: {
          message: 'Too many probe-all requests for this board. Please wait before refreshing.',
          retryAfterSeconds: retryAfter,
        },
      },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      },
    );
  }

  const checks = await db('board_health_checks')
    .where({ board_id: boardId, is_active: true })
    .orderBy('created_at', 'asc');

  if (checks.length === 0) {
    return Response.json({ data: [] });
  }

  // Run probes concurrently; skip individual checks that are rate-limited.
  const results = await Promise.all(
    checks.map(async (check: { id: string; url: string }) => {
      const perCheckKey = `probe:${check.id}`;
      if (!checkRateLimit(perCheckKey)) {
        // Skip silently — the latest cached result remains in the DB.
        return null;
      }
      try {
        const result = await probe({ healthCheckId: check.id, url: check.url });
        return {
          id: result.id,
          healthCheckId: result.healthCheckId,
          status: result.status,
          httpStatus: result.httpStatus,
          responseTimeMs: result.responseTimeMs,
          errorMessage: result.errorMessage,
          checkedAt: result.checkedAt,
        };
      } catch {
        // If a probe throws unexpectedly, exclude it from the response rather
        // than failing the entire batch.
        return null;
      }
    }),
  );

  // Filter out skipped/errored entries.
  const data = results.filter(Boolean);

  return Response.json({ data });
}
