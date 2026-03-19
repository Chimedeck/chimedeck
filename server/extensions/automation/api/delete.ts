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
  const currentUser = (req as AuthenticatedRequest).currentUser!;

  const board = await db('boards').where({ id: boardId }).first();
  if (!board) {
    return Response.json({ error: { name: 'board-not-found' } }, { status: 404 });
  }

  // Only workspace members with at least MEMBER role can manage automations.
  const membership = await db('memberships')
    .where({ user_id: currentUser.id, workspace_id: board.workspace_id })
    .first();
  if (!membership || !['OWNER', 'ADMIN', 'MEMBER'].includes(membership.role)) {
    return Response.json({ error: { name: 'insufficient-role' } }, { status: 403 });
  }

  // Automations are private to their creator — only the creator can delete.
  const automation = await db('automations')
    .where({ id: automationId, board_id: boardId, created_by: currentUser.id })
    .first();
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
