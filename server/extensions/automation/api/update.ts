// PATCH /api/v1/boards/:boardId/automations/:automationId — partial update of an automation.
import { randomUUID } from 'crypto';
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { automationConfig } from '../config';
import type { AutomationType } from '../common/types';
import { formatAutomation } from './format';

const VALID_AUTOMATION_TYPES: AutomationType[] = [
  'RULE',
  'CARD_BUTTON',
  'BOARD_BUTTON',
  'SCHEDULED',
  'DUE_DATE',
];

interface UpdateAutomationBody {
  name?: unknown;
  automationType?: unknown;
  isEnabled?: unknown;
  icon?: unknown;
  trigger?: {
    triggerType?: unknown;
    config?: unknown;
  } | null;
  actions?: Array<{
    id?: unknown;
    position?: unknown;
    actionType?: unknown;
    config?: unknown;
  }>;
}

export async function handleUpdateAutomation(
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

  let body: UpdateAutomationBody;
  try {
    body = (await req.json()) as UpdateAutomationBody;
  } catch {
    return Response.json({ error: { name: 'bad-request', data: { message: 'Invalid JSON body' } } }, { status: 400 });
  }

  if (body.automationType !== undefined && !VALID_AUTOMATION_TYPES.includes(body.automationType as AutomationType)) {
    return Response.json({ error: { name: 'automation-type-invalid' } }, { status: 422 });
  }

  if (body.trigger !== undefined && body.trigger !== null && typeof body.trigger.triggerType !== 'string') {
    return Response.json({ error: { name: 'trigger-type-unknown' } }, { status: 422 });
  }

  if (body.actions !== undefined && !Array.isArray(body.actions)) {
    return Response.json({ error: { name: 'bad-request', data: { message: 'actions must be an array' } } }, { status: 400 });
  }

  if (body.actions) {
    for (const action of body.actions) {
      if (!action.actionType || typeof action.actionType !== 'string') {
        return Response.json({ error: { name: 'action-type-unknown' } }, { status: 422 });
      }
    }
  }

  await db.transaction(async (trx) => {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined && typeof body.name === 'string') updates['name'] = body.name.trim();
    if (body.automationType !== undefined) updates['automation_type'] = body.automationType;
    if (body.isEnabled !== undefined) updates['is_enabled'] = body.isEnabled;
    if (body.icon !== undefined) updates['icon'] = body.icon || null;

    if (Object.keys(updates).length > 1) {
      await trx('automations').where({ id: automationId }).update(updates);
    }

    // Replace trigger if provided
    if (body.trigger !== undefined) {
      await trx('automation_triggers').where({ automation_id: automationId }).delete();
      if (body.trigger !== null) {
        await trx('automation_triggers').insert({
          id: randomUUID(),
          automation_id: automationId,
          trigger_type: body.trigger.triggerType as string,
          config: JSON.stringify(body.trigger.config ?? {}),
        });
      }
    }

    // Replace actions if provided
    if (body.actions !== undefined) {
      await trx('automation_actions').where({ automation_id: automationId }).delete();
      if (body.actions.length > 0) {
        const actionRows = body.actions.map((a, i) => ({
          id: randomUUID(),
          automation_id: automationId,
          position: typeof a.position === 'number' ? a.position : i,
          action_type: a.actionType as string,
          config: JSON.stringify(a.config ?? {}),
        }));
        await trx('automation_actions').insert(actionRows);
      }
    }
  });

  const [updated, trigger, actions] = await Promise.all([
    db('automations').where({ id: automationId }).first(),
    db('automation_triggers').where({ automation_id: automationId }).first(),
    db('automation_actions').where({ automation_id: automationId }).orderBy('position', 'asc').select('*'),
  ]);

  return Response.json({ data: formatAutomation(updated, trigger ?? null, actions) });
}
