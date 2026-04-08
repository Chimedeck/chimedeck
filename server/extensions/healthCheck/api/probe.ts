// POST /api/v1/boards/:boardId/health-checks/:id/probe
// Runs an on-demand probe for a single health check entry.
// Auth: board member. Rate limited to 1 request per health check per 5 seconds.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { applyBoardVisibility } from '../../../middlewares/boardVisibility';
import { probe } from '../mods/probe';
import { checkRateLimit, retryAfterMs } from '../mods/rateLimiter';

export async function handleProbeHealthCheck(
  req: Request,
  boardId: string,
  healthCheckId: string,
): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const visibilityError = await applyBoardVisibility(req, boardId);
  if (visibilityError) return visibilityError;

  // Look up the health check and verify it belongs to this board.
  const check = await db('board_health_checks')
    .where({ id: healthCheckId, board_id: boardId, is_active: true })
    .first();

  if (!check) {
    return Response.json(
      { name: 'health-check-not-found', data: { message: 'Health check not found' } },
      { status: 404 },
    );
  }

  // Per-health-check rate limit: 1 probe per 5 seconds.
  const rateLimitKey = `probe:${healthCheckId}`;
  if (!checkRateLimit(rateLimitKey)) {
    const retryAfter = Math.ceil(retryAfterMs(rateLimitKey) / 1000);
    return Response.json(
      {
        name: 'rate-limit-exceeded',
        data: { message: 'Too many probe requests. Please wait before probing again.', retryAfterSeconds: retryAfter },
      },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      },
    );
  }

  const result = await probe({ healthCheckId: check.id, url: check.url, expectedStatus: check.expected_status ?? null });

  return Response.json({
    data: {
      id: result.id,
      healthCheckId: result.healthCheckId,
      status: result.status,
      httpStatus: result.httpStatus,
      responseTimeMs: result.responseTimeMs,
      errorMessage: result.errorMessage,
      checkedAt: result.checkedAt,
    },
  });
}
