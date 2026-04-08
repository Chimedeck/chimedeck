// DELETE /api/v1/boards/:boardId/health-checks/:healthCheckId
// Removes a health check entry and cascades to its result history.
// Auth: board member.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { applyBoardVisibility } from '../../../middlewares/boardVisibility';

export async function handleRemoveHealthCheck(
  req: Request,
  boardId: string,
  healthCheckId: string,
): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const visibilityError = await applyBoardVisibility(req, boardId);
  if (visibilityError) return visibilityError;

  const check = await db('board_health_checks')
    .where({ id: healthCheckId, board_id: boardId })
    .first();

  if (!check) {
    return Response.json(
      { error: { name: 'health-check-not-found', data: { message: 'Health check not found' } } },
      { status: 404 },
    );
  }

  // Hard-delete — results cascade via ON DELETE CASCADE on the FK.
  await db('board_health_checks').where({ id: healthCheckId }).del();

  return Response.json({ data: {} });
}
