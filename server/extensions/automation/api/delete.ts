// DELETE /api/v1/boards/:boardId/automations/:automationId — delete an automation.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { automationConfig } from '../config';

export async function handleDeleteAutomation(
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

  // Cascade delete is handled by FK constraints, but we do it explicitly for clarity.
  await db.transaction(async (trx) => {
    await trx('automation_actions').where({ automation_id: automationId }).delete();
    await trx('automation_triggers').where({ automation_id: automationId }).delete();
    await trx('automation_run_log').where({ automation_id: automationId }).delete();
    await trx('automations').where({ id: automationId }).delete();
  });

  return new Response(null, { status: 204 });
}
