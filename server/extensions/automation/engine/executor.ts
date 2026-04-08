// Automation executor — runs an automation's ordered actions inside a DB transaction.
// Marks run status as SUCCESS, PARTIAL (some actions failed), or FAILED (all failed).

import { db } from '../../../common/db';
import { getActionHandler } from './registry';
import type {
  AutomationRow,
  AutomationActionRow,
  AutomationEvent,
  EvaluationContext,
  RunStatus,
} from '../common/types';

export interface ExecuteResult {
  status: RunStatus;
  /** Aggregated error messages from individual failed actions. */
  errorMessage: string | null;
}

/**
 * Iterates ordered actions in a single DB transaction.
 * Per-action errors are caught individually — the transaction is committed even
 * when some actions fail (PARTIAL run), so successful side-effects are preserved.
 * If every action fails the status is FAILED.
 */
export async function executeAutomation({
  automation,
  actions,
  event,
  evalContext,
}: {
  automation: AutomationRow;
  actions: AutomationActionRow[];
  event: AutomationEvent;
  evalContext: EvaluationContext;
}): Promise<ExecuteResult> {
  const sortedActions = [...actions].sort((a, b) => a.position - b.position);

  let successCount = 0;
  const errors: string[] = [];
  const postCommitCallbacks: Array<() => void> = [];
  const postCommit = (fn: () => void) => postCommitCallbacks.push(fn);

  await db.transaction(async (trx) => {
    for (const action of sortedActions) {
      const handler = getActionHandler(action.action_type);

      if (!handler) {
        errors.push(`action-type-unknown: ${action.action_type}`);
        continue;
      }

      try {
        await handler.execute({ automation, action, event, evalContext, trx, postCommit });
        successCount++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${action.action_type}: ${message}`);
      }
    }
  });

  // Fire post-commit side effects (e.g. WS broadcasts) after the transaction is committed.
  for (const fn of postCommitCallbacks) {
    try { fn(); } catch { /* ignore */ }
  }

  const totalActions = sortedActions.length;

  let status: RunStatus;
  if (successCount === totalActions) {
    status = 'SUCCESS';
  } else if (successCount === 0) {
    status = 'FAILED';
  } else {
    status = 'PARTIAL';
  }

  return {
    status,
    errorMessage: errors.length > 0 ? errors.join(' | ') : null,
  };
}
