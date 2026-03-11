// Automation registry — maps trigger_type and action_type strings to handler functions.
// New handlers are registered here; the engine uses these maps without needing code changes.

import type { TriggerHandler, ActionHandler } from '../common/types';

// ── Trigger registry ──────────────────────────────────────────────────────────

const triggerRegistry = new Map<string, TriggerHandler>();

export function registerTrigger(handler: TriggerHandler): void {
  triggerRegistry.set(handler.type, handler);
}

export function getTriggerHandler(type: string): TriggerHandler | undefined {
  return triggerRegistry.get(type);
}

export function getAllTriggerTypes(): string[] {
  return Array.from(triggerRegistry.keys());
}

export function getAllTriggerHandlers(): TriggerHandler[] {
  return Array.from(triggerRegistry.values());
}

// ── Action registry ───────────────────────────────────────────────────────────

const actionRegistry = new Map<string, ActionHandler>();

export function registerAction(handler: ActionHandler): void {
  actionRegistry.set(handler.type, handler);
}

export function getActionHandler(type: string): ActionHandler | undefined {
  return actionRegistry.get(type);
}

export function getAllActionTypes(): string[] {
  return Array.from(actionRegistry.keys());
}
