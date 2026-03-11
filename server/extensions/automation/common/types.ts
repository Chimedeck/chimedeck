// Shared types for the automation system.

export type AutomationType = 'RULE' | 'CARD_BUTTON' | 'BOARD_BUTTON' | 'SCHEDULED' | 'DUE_DATE';
export type RunStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED';

export interface AutomationRow {
  id: string;
  board_id: string;
  created_by: string;
  name: string;
  automation_type: AutomationType;
  is_enabled: boolean;
  icon: string | null;
  run_count: number;
  last_run_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface AutomationTriggerRow {
  id: string;
  automation_id: string;
  trigger_type: string;
  config: Record<string, unknown>;
}

export interface AutomationActionRow {
  id: string;
  automation_id: string;
  position: number;
  action_type: string;
  config: Record<string, unknown>;
}

export interface AutomationRunLogRow {
  id: string;
  automation_id: string;
  triggered_by_user_id: string | null;
  card_id: string | null;
  status: RunStatus;
  context: Record<string, unknown>;
  error_message: string | null;
  ran_at: Date;
}

// Event passed to evaluate() from the event pipeline.
export interface AutomationEvent {
  type: string;
  boardId: string;
  entityId: string;
  actorId: string;
  payload: Record<string, unknown>;
}

// Context enriched by the engine for matchers / executors.
export interface EvaluationContext {
  actorId: string;
  cardId?: string;
  [key: string]: unknown;
}

// A trigger handler registered in the TRIGGER_REGISTRY.
export interface TriggerHandler {
  type: string;
  label: string;
  // Zod schema used to validate trigger config at save time.
  configSchema: import('zod').ZodTypeAny;
  /** Returns true when this trigger fires for the given event + config. */
  matches(event: AutomationEvent, config: Record<string, unknown>): boolean;
}

// An action handler registered in the ACTION_REGISTRY.
export interface ActionHandler {
  type: string;
  /** Execute the action. Throws on unrecoverable failure. */
  execute(context: ActionContext): Promise<void>;
}

export interface ActionContext {
  automation: AutomationRow;
  action: AutomationActionRow;
  event: AutomationEvent;
  evalContext: EvaluationContext;
  trx: import('knex').Knex.Transaction;
}
