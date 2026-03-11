// Automation engine public API.
// evaluate() is the single entry point called by the event pipeline.
// It is fire-and-forget — it never throws and never blocks the calling mutation.

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

    if (matching.length === 0) return;

    // Process in chunks of maxConcurrent to avoid overwhelming the DB.
    for (let i = 0; i < matching.length; i += automationConfig.maxConcurrent) {
      const batch = matching.slice(i, i + automationConfig.maxConcurrent);
      await Promise.all(
        batch.map((automation) => runOne({ automation, event, evalContext: context })),
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
