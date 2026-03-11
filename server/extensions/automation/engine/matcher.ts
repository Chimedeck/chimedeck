// Automation matcher — checks whether an incoming event fires a RULE automation's trigger.

import { getTriggerHandler } from './registry';
import type { AutomationEvent, AutomationTriggerRow } from '../common/types';

export interface MatchInput {
  event: AutomationEvent;
  trigger: AutomationTriggerRow;
}

/**
 * Returns true when the registered trigger handler for `trigger.trigger_type`
 * says the event matches the stored config.
 *
 * Returns false (not throws) when the trigger_type has no registered handler —
 * unregistered types are silently skipped so in-flight automations don't crash
 * when handlers are removed during a rolling deploy.
 */
export function matchesTrigger({ event, trigger }: MatchInput): boolean {
  const handler = getTriggerHandler(trigger.trigger_type);
  if (!handler) return false;

  try {
    return handler.matches(event, trigger.config);
  } catch {
    // Handler bugs must never propagate — treat as non-match.
    return false;
  }
}
