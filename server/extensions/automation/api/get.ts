// GET /api/v1/boards/:boardId/automations/:automationId — fetch a single automation.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { automationConfig } from '../config';
import { formatAutomation } from './format';

export async function handleGetAutomation(
  req: Request,
  boardId: string,
  automationId: string,
): Promise<Response> {
  if (!automationConfig.enabled) {
    return Response.json({ error: { name: 'feature-disabled' } }, { status: 404 });
  }

  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const automation = await db('automations').where({ id: automationId, board_id: boardId }).first();
  if (!automation) {
    return Response.json({ error: { name: 'automation-not-found' } }, { status: 404 });
  }

  const [trigger, actions] = await Promise.all([
    db('automation_triggers').where({ automation_id: automationId }).first(),
    db('automation_actions').where({ automation_id: automationId }).orderBy('position', 'asc').select('*'),
  ]);

  return Response.json({ data: formatAutomation(automation, trigger ?? null, actions) });
}
