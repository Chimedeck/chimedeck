// Automation engine public API.
// evaluate() is the event-pipeline entry point; execute() is the scheduler entry point.
// Both are fire-and-forget — they never throw and never block the caller.

import { db } from '../../../common/db';
import { automationConfig } from '../config';
import { matchesTrigger } from './matcher';
import { executeAutomation } from './executor';
import { writeRunLog } from './logger';
import type {
  AutomationRow,
  AutomationTriggerRow,
  AutomationActionRow,
  AutomationEvent,
  EvaluationContext,
} from '../common/types';

interface AutomationWithRelations extends AutomationRow {
  trigger: AutomationTriggerRow | null;
  actions: AutomationActionRow[];
}

export interface EvaluateInput {
  boardId: string;
  event: AutomationEvent;
  context: EvaluationContext;
}

/**
 * Loads all enabled RULE automations for the board, runs the matcher against each,
 * then executes matching automations (max 5 concurrently) and writes run logs.
 *
 * All errors are caught internally — this function must never throw.
 */
export async function evaluate({ boardId, event, context }: EvaluateInput): Promise<void> {
  if (!automationConfig.enabled) return;

  try {
    const automations = await loadEnabledRules(boardId);
    const matching = automations.filter(
      (a) => a.trigger !== null && matchesTrigger({ event, trigger: a.trigger }),
    );

    console.log('[automation:evaluate] event:', event.type, 'board:', boardId, 'matching:', matching.length);

    if (matching.length === 0) return;

    // Process in chunks of maxConcurrent to avoid overwhelming the DB.
    for (let i = 0; i < matching.length; i += automationConfig.maxConcurrent) {
      const batch = matching.slice(i, i + automationConfig.maxConcurrent);
      await Promise.all(
        batch.map((automation) => {
          // For RULE automations the actor is always the automation's creator — not the user
          // who triggered the event. This keeps rules personal: actions (comments, copies,
          // moves) are attributed to the person who set the rule up, and permission checks
          // (e.g. card.copy_to_board) run against the creator's access, not the event actor.
          const ruleEvalContext: typeof context = {
            ...context,
            actorId: automation.created_by,
          };
          return runOne({ automation, event, evalContext: ruleEvalContext });
        }),
      );
    }
  } catch {
    // Top-level safety net — automation errors must never propagate.
  }
}

async function runOne({
  automation,
  event,
  evalContext,
}: {
  automation: AutomationWithRelations;
  event: AutomationEvent;
  evalContext: EvaluationContext;
}): Promise<void> {
  try {
    const result = await executeAutomation({
      automation,
      actions: automation.actions,
      event,
      evalContext,
    });

    await writeRunLog({
      automation,
      event,
      evalContext,
      status: result.status,
      errorMessage: result.errorMessage,
      context: { eventType: event.type, payload: event.payload },
    });
  } catch {
    // Per-automation safety net — one automation failing must not affect others.
  }
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadEnabledRules(boardId: string): Promise<AutomationWithRelations[]> {
  const rows = await db('automations')
    .where({ board_id: boardId, automation_type: 'RULE', is_enabled: true })
    .select('*');

  if (rows.length === 0) return [];

  const automationIds = rows.map((r: AutomationRow) => r.id);

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

  return rows.map((r: AutomationRow) => ({
    ...r,
    trigger: triggersByAutomation.get(r.id) ?? null,
    actions: actionsByAutomation.get(r.id) ?? [],
  }));
}

// ── Scheduler direct execution ────────────────────────────────────────────────

export interface ExecuteInput {
  automationId: string;
  boardId: string;
  cardId: string | null;
  actorId: string | null;
}

/**
 * Directly executes a single SCHEDULED or DUE_DATE automation by ID.
 * Called by the scheduler LISTEN client or Worker fallback after receiving a tick.
 * Fire-and-forget — never throws.
 */
export async function execute({ automationId, boardId, cardId, actorId }: ExecuteInput): Promise<void> {
  if (!automationConfig.enabled) return;

  try {
    const row = await db('automations')
      .where({ id: automationId, board_id: boardId, is_enabled: true })
      .first<AutomationRow>();

    if (!row) return;

    const actions = await db('automation_actions')
      .where({ automation_id: automationId })
      .orderBy('position', 'asc')
      .select<AutomationActionRow[]>('*');

    if (actions.length === 0) return;

    const automation: AutomationWithRelations = { ...row, trigger: null, actions };

    const event: AutomationEvent = {
      type: row.automation_type,
      boardId,
      entityId: cardId ?? boardId,
      actorId: actorId ?? 'system',
      payload: { cardId, scheduledAt: new Date().toISOString() },
    };

    const evalContext: EvaluationContext = {
      actorId: actorId ?? 'system',
      ...(cardId ? { cardId } : {}),
    };

    const result = await executeAutomation({ automation, actions, event, evalContext });

    await writeRunLog({
      automation,
      event,
      evalContext,
      status: result.status,
      errorMessage: result.errorMessage,
      context: { eventType: row.automation_type, payload: event.payload },
    });
  } catch {
    // Scheduler errors must never propagate — log silently.
  }
}
