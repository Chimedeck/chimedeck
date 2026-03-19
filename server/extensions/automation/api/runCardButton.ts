// POST /api/v1/cards/:cardId/automation-buttons/:automationId/run
// Executes a CARD_BUTTON automation on behalf of the requesting user.
// Returns { data: { runLogId, status } } or a structured error response.

import { randomUUID } from 'crypto';
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { automationConfig } from '../config';
import { executeAutomation } from '../engine/executor';
import { writeRunLog } from '../engine/logger';
import type { AutomationRow, AutomationActionRow, AutomationEvent, EvaluationContext } from '../common/types';

export async function handleRunCardButton(
  req: Request,
  cardId: string,
  automationId: string,
): Promise<Response> {
  if (!automationConfig.enabled) {
    return Response.json({ error: { name: 'feature-disabled' } }, { status: 404 });
  }

  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;
  const currentUser = (req as AuthenticatedRequest).currentUser!;

  // Load the card and resolve boardId for membership check.
  const card = await db('cards').where({ id: cardId }).first();
  if (!card) {
    return Response.json({ error: { name: 'card-not-found' } }, { status: 404 });
  }

  // Verify caller is a workspace member of the board.
  const list = await db('lists').where({ id: card.list_id }).first();
  if (!list) {
    return Response.json({ error: { name: 'list-not-found' } }, { status: 404 });
  }

  const boardForCard = await db('boards').where({ id: list.board_id }).first();
  if (!boardForCard) {
    return Response.json({ error: { name: 'board-not-found' } }, { status: 404 });
  }

  const boardMembership = await db('memberships')
    .where({ user_id: currentUser.id, workspace_id: boardForCard.workspace_id })
    .first();
  if (!boardMembership) {
    return Response.json({ error: { name: 'not-a-board-member' } }, { status: 403 });
  }

  // Load the CARD_BUTTON automation — must belong to the same board.
  const automation = await db('automations')
    .where({ id: automationId, board_id: list.board_id, automation_type: 'CARD_BUTTON', is_enabled: true })
    .first<AutomationRow>();
  if (!automation) {
    return Response.json({ error: { name: 'automation-not-found' } }, { status: 404 });
  }

  const actions = await db('automation_actions')
    .where({ automation_id: automationId })
    .orderBy('position', 'asc')
    .select<AutomationActionRow[]>('*');

  const event: AutomationEvent = {
    type: 'CARD_BUTTON',
    boardId: list.board_id as string,
    entityId: cardId,
    actorId: currentUser.id as string,
    payload: { cardId, automationId, triggeredManually: true },
  };

  const evalContext: EvaluationContext = {
    actorId: currentUser.id as string,
    cardId,
  };

  const result = await executeAutomation({ automation, actions, event, evalContext });

  // Persist run log — reuse logger so run_count and WS event are handled consistently.
  const runLogId = randomUUID();
  await writeRunLog({
    automation,
    event,
    evalContext,
    status: result.status,
    errorMessage: result.errorMessage,
    context: { eventType: 'CARD_BUTTON', cardId, automationId, triggeredBy: currentUser.id },
  }).catch(() => {
    // Logging failures must not surface to the caller.
  });

  return Response.json({ data: { runLogId, status: result.status } });
}
