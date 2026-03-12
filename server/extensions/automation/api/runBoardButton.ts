// POST /api/v1/boards/:boardId/automation-buttons/:automationId/run
// Executes a BOARD_BUTTON automation across all cards that match the target scope.
// Max 50 cards per run to prevent runaway execution.

import { randomUUID } from 'crypto';
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { automationConfig } from '../config';
import { executeAutomation } from '../engine/executor';
import { writeRunLog } from '../engine/logger';
import type { AutomationRow, AutomationActionRow, AutomationEvent, EvaluationContext } from '../common/types';

const MAX_CARDS_PER_RUN = 50;

/** Resolves targetScope config to a list of cardIds on the board. */
async function resolveScope(
  boardId: string,
  config: Record<string, unknown>,
): Promise<string[]> {
  const scope = config.targetScope as string | undefined;

  // Base query: cards that belong to active (non-archived) lists on this board.
  let query = db('cards')
    .join('lists', 'cards.list_id', 'lists.id')
    .where('lists.board_id', boardId)
    .whereNull('cards.archived_at')
    .orderBy('cards.created_at', 'asc')
    .limit(MAX_CARDS_PER_RUN)
    .select('cards.id as cardId');

  if (scope === 'list' && config.listId) {
    query = query.where('cards.list_id', config.listId as string);
  } else if (scope === 'filter') {
    // Label filter
    if (Array.isArray(config.labelIds) && (config.labelIds as string[]).length > 0) {
      const labelIds = config.labelIds as string[];
      query = query.whereExists(
        db('card_labels').whereRaw('card_labels.card_id = cards.id').whereIn('card_labels.label_id', labelIds),
      );
    }
    // Member filter
    if (Array.isArray(config.memberIds) && (config.memberIds as string[]).length > 0) {
      const memberIds = config.memberIds as string[];
      query = query.whereExists(
        db('card_members').whereRaw('card_members.card_id = cards.id').whereIn('card_members.user_id', memberIds),
      );
    }
  }
  // scope === 'board' — no extra filtering needed

  const rows = await query;
  return rows.map((r: { cardId: string }) => r.cardId);
}

export async function handleRunBoardButton(
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

  // Verify board exists and caller is a member.
  const board = await db('boards').where({ id: boardId }).first();
  if (!board) {
    return Response.json({ error: { name: 'board-not-found' } }, { status: 404 });
  }

  const boardMember = await db('board_members')
    .where({ board_id: boardId, user_id: currentUser.id })
    .first();
  if (!boardMember) {
    return Response.json({ error: { name: 'not-a-board-member' } }, { status: 403 });
  }

  // Load the BOARD_BUTTON automation.
  const automation = await db('automations')
    .where({ id: automationId, board_id: boardId, automation_type: 'BOARD_BUTTON', is_enabled: true })
    .first<AutomationRow>();
  if (!automation) {
    return Response.json({ error: { name: 'automation-not-found' } }, { status: 404 });
  }

  const actions = await db('automation_actions')
    .where({ automation_id: automationId })
    .orderBy('position', 'asc')
    .select<AutomationActionRow[]>('*');

  // Parse scope config from the automation's config column.
  let scopeConfig: Record<string, unknown> = { targetScope: 'board' };
  try {
    const raw = automation.config as string | Record<string, unknown> | null;
    if (raw) scopeConfig = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    // Fall back to board-wide scope
  }

  const cardIds = await resolveScope(boardId, scopeConfig);

  if (cardIds.length === 0) {
    return Response.json({ data: { runLogId: null, cardCount: 0, status: 'SUCCESS' } });
  }

  let successCount = 0;
  let failCount = 0;
  // A single runLogId for the overall board button run (returned in the response).
  const batchRunLogId = randomUUID();

  for (const cardId of cardIds) {
    const event: AutomationEvent = {
      type: 'BOARD_BUTTON',
      boardId,
      entityId: cardId,
      actorId: currentUser.id as string,
      payload: { cardId, automationId, triggeredManually: true, scope: scopeConfig, batchRunLogId },
    };

    const evalContext: EvaluationContext = {
      actorId: currentUser.id as string,
      cardId,
    };

    const result = await executeAutomation({ automation, actions, event, evalContext });

    if (result.status === 'FAILED') {
      failCount++;
    } else {
      successCount++;
    }

    await writeRunLog({
      automation,
      event,
      evalContext,
      status: result.status,
      errorMessage: result.errorMessage,
      context: { eventType: 'BOARD_BUTTON', cardId, automationId, triggeredBy: currentUser.id, batchRunLogId },
    }).catch(() => {
      // Logging failures must not surface to the caller.
    });
  }

  const overallStatus =
    failCount === 0 ? 'SUCCESS' : successCount === 0 ? 'FAILED' : 'PARTIAL';

  return Response.json({
    data: {
      runLogId: batchRunLogId,
      cardCount: cardIds.length,
      status: overallStatus,
    },
  });
}
