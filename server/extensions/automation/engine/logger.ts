// Automation logger — writes to automation_run_log and caps rows at 1000 per automation.
// Also publishes the automation_ran WS event on the board channel.

import { randomUUID } from 'crypto';
import { db } from '../../../common/db';
import { broadcast } from '../../realtime/mods/rooms/broadcast';
import type { AutomationRow, AutomationEvent, EvaluationContext, RunStatus } from '../common/types';
import { automationConfig } from '../config';

export interface WriteRunLogInput {
  automation: AutomationRow;
  event: AutomationEvent;
  evalContext: EvaluationContext;
  status: RunStatus;
  errorMessage?: string | null;
  /** Snapshot of what fired the automation — stored verbatim. */
  context?: Record<string, unknown>;
}

/**
 * Persists a run log row, purges oldest rows beyond the cap, increments
 * run_count + last_run_at on the automation, and broadcasts automation_ran.
 *
 * Never throws — logging failures must not surface to callers.
 */
export async function writeRunLog(input: WriteRunLogInput): Promise<void> {
  const { automation, event, evalContext, status, errorMessage, context } = input;
  const runLogId = randomUUID();

  try {
    await db.transaction(async (trx) => {
      // Insert the new run log row.
      await trx('automation_run_log').insert({
        id: runLogId,
        automation_id: automation.id,
        triggered_by_user_id: evalContext.actorId ?? null,
        card_id: evalContext.cardId ?? null,
        status,
        context: JSON.stringify(context ?? { eventType: event.type, payload: event.payload }),
        error_message: errorMessage ?? null,
        ran_at: new Date().toISOString(),
      });

      // Purge oldest rows beyond the per-automation cap.
      // Using a subquery to identify the rows to keep so we only hit the DB once.
      await trx.raw(
        `DELETE FROM automation_run_log
         WHERE automation_id = ?
           AND id NOT IN (
             SELECT id FROM automation_run_log
             WHERE automation_id = ?
             ORDER BY ran_at DESC
             LIMIT ?
           )`,
        [automation.id, automation.id, automationConfig.runLogCap],
      );

      // Keep run_count and last_run_at current.
      await trx('automations')
        .where({ id: automation.id })
        .update({ run_count: db.raw('run_count + 1'), last_run_at: db.fn.now() });
    });
  } catch {
    // Logging must never surface errors to the engine.
    return;
  }

  // Publish WS event fire-and-forget — board clients can update badges in real-time.
  try {
    broadcast({
      boardId: automation.board_id,
      message: JSON.stringify({
        type: 'automation_ran',
        payload: {
          automationId: automation.id,
          runLogId,
          status,
          ranAt: new Date().toISOString(),
        },
      }),
    });
  } catch {
    // WS publish failure is non-fatal.
  }
}
