// Shared helper — converts DB rows to the canonical automation API response shape.
import type { AutomationRow, AutomationTriggerRow, AutomationActionRow } from '../common/types';

export function formatAutomation(
  automation: AutomationRow,
  trigger: AutomationTriggerRow | null,
  actions: AutomationActionRow[],
) {
  return {
    id: automation.id,
    boardId: automation.board_id,
    createdBy: automation.created_by,
    name: automation.name,
    automationType: automation.automation_type,
    isEnabled: automation.is_enabled,
    icon: automation.icon,
    runCount: automation.run_count,
    lastRunAt: automation.last_run_at,
    createdAt: automation.created_at,
    updatedAt: automation.updated_at,
    trigger: trigger
      ? {
          id: trigger.id,
          triggerType: trigger.trigger_type,
          config: trigger.config,
        }
      : null,
    actions: actions.map((a) => ({
      id: a.id,
      position: a.position,
      actionType: a.action_type,
      config: a.config,
    })),
  };
}
