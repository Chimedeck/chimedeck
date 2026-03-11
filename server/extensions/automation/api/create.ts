// POST /api/v1/boards/:boardId/automations — create a new automation.
import { randomUUID } from 'crypto';
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { automationConfig } from '../config';
import type { AutomationType } from '../common/types';
import { validateTrigger } from '../engine/triggers/validate';
// Ensure trigger registry is populated.
import '../engine/triggers/index';
import { formatAutomation } from './format';

const VALID_AUTOMATION_TYPES: AutomationType[] = [
  'RULE',
  'CARD_BUTTON',
  'BOARD_BUTTON',
  'SCHEDULED',
  'DUE_DATE',
];

interface CreateAutomationBody {
  name?: unknown;
  automationType?: unknown;
  isEnabled?: unknown;
  icon?: unknown;
  trigger?: {
    triggerType?: unknown;
    config?: unknown;
  } | null;
  actions?: Array<{
    position?: unknown;
    actionType?: unknown;
    config?: unknown;
  }>;
}

export async function handleCreateAutomation(req: Request, boardId: string): Promise<Response> {
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

  let body: CreateAutomationBody;
  try {
    body = (await req.json()) as CreateAutomationBody;
  } catch {
    return Response.json({ error: { name: 'bad-request', data: { message: 'Invalid JSON body' } } }, { status: 400 });
  }

  if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
    return Response.json({ error: { name: 'bad-request', data: { message: 'name is required' } } }, { status: 400 });
  }

  if (!body.automationType || !VALID_AUTOMATION_TYPES.includes(body.automationType as AutomationType)) {
    return Response.json({ error: { name: 'automation-type-invalid' } }, { status: 422 });
  }

  const automationType = body.automationType as AutomationType;

  // Validate trigger (required for RULE and DUE_DATE types)
  if ((automationType === 'RULE' || automationType === 'DUE_DATE') && !body.trigger) {
    return Response.json(
      { error: { name: 'bad-request', data: { message: 'trigger is required for RULE and DUE_DATE automations' } } },
      { status: 400 },
    );
  }

  if (body.trigger && typeof body.trigger.triggerType !== 'string') {
    return Response.json({ error: { name: 'trigger-type-unknown' } }, { status: 422 });
  }

  // Validate trigger type and config against the registry.
  if (body.trigger && typeof body.trigger.triggerType === 'string') {
    const triggerValidation = validateTrigger(body.trigger.triggerType, body.trigger.config ?? {});
    if (!triggerValidation.valid) {
      const status = triggerValidation.errorName === 'trigger-type-unknown' ? 422 : 422;
      return Response.json(
        { error: { name: triggerValidation.errorName, data: triggerValidation.errorData } },
        { status },
      );
    }
  }

  // Validate actions array
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

  const automationId = randomUUID();

  await db.transaction(async (trx) => {
    await trx('automations').insert({
      id: automationId,
      board_id: boardId,
      created_by: currentUser.id,
      name: (body.name as string).trim(),
      automation_type: automationType,
      is_enabled: body.isEnabled !== false,
      icon: body.icon && typeof body.icon === 'string' ? body.icon : null,
    });

    if (body.trigger) {
      await trx('automation_triggers').insert({
        id: randomUUID(),
        automation_id: automationId,
        trigger_type: body.trigger.triggerType as string,
        config: JSON.stringify(body.trigger.config ?? {}),
      });
    }

    if (body.actions && body.actions.length > 0) {
      const actionRows = body.actions.map((a, i) => ({
        id: randomUUID(),
        automation_id: automationId,
        position: typeof a.position === 'number' ? a.position : i,
        action_type: a.actionType as string,
        config: JSON.stringify(a.config ?? {}),
      }));
      await trx('automation_actions').insert(actionRows);
    }
  });

  const [automation, trigger, actions] = await Promise.all([
    db('automations').where({ id: automationId }).first(),
    db('automation_triggers').where({ automation_id: automationId }).first(),
    db('automation_actions').where({ automation_id: automationId }).orderBy('position', 'asc').select('*'),
  ]);

  return Response.json({ data: formatAutomation(automation, trigger ?? null, actions) }, { status: 201 });
}
