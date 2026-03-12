// GET /api/v1/boards/:boardId/automations — list all automations for a board.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { automationConfig } from '../config';
import type { AutomationRow, AutomationTriggerRow, AutomationActionRow } from '../common/types';
import { formatAutomation } from './format';

export async function handleListAutomations(req: Request, boardId: string): Promise<Response> {
  if (!automationConfig.enabled) {
    return Response.json({ error: { name: 'feature-disabled' } }, { status: 404 });
  }

  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;
  const currentUser = (req as AuthenticatedRequest).currentUser!;

  // Automations are private to their creator — each user only sees their own.
  const automations = await db('automations')
    .where({ board_id: boardId, created_by: currentUser.id })
    .orderBy('created_at', 'asc')
    .select('*');

  if (automations.length === 0) return Response.json({ data: [] });

  const automationIds = automations.map((a: AutomationRow) => a.id);

  const [triggers, actions] = await Promise.all([
    db('automation_triggers').whereIn('automation_id', automationIds).select('*'),
    db('automation_actions')
      .whereIn('automation_id', automationIds)
      .orderBy('position', 'asc')
      .select('*'),
  ]);

  const triggersByAutomation = new Map<string, AutomationTriggerRow>();
  for (const t of triggers as AutomationTriggerRow[]) {
    triggersByAutomation.set(t.automation_id, t);
  }

  const actionsByAutomation = new Map<string, AutomationActionRow[]>();
  for (const a of actions as AutomationActionRow[]) {
    const list = actionsByAutomation.get(a.automation_id) ?? [];
    list.push(a);
    actionsByAutomation.set(a.automation_id, list);
  }

  const data = automations.map((a: AutomationRow) =>
    formatAutomation(a, triggersByAutomation.get(a.id) ?? null, actionsByAutomation.get(a.id) ?? []),
  );

  return Response.json({ data });
}
