// Automation domain types — mirrors the server's formatAutomation response shape.

export type AutomationType = 'RULE' | 'CARD_BUTTON' | 'BOARD_BUTTON' | 'SCHEDULED' | 'DUE_DATE';

export interface AutomationTrigger {
  id: string;
  triggerType: string;
  config: Record<string, unknown>;
}

export interface AutomationAction {
  id: string;
  position: number;
  actionType: string;
  config: Record<string, unknown>;
}

export interface Automation {
  id: string;
  boardId: string;
  createdBy: string;
  name: string;
  automationType: AutomationType;
  isEnabled: boolean;
  icon: string | null;
  runCount: number;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  trigger: AutomationTrigger | null;
  actions: AutomationAction[];
}

// Discovery types returned by GET /api/v1/automation/trigger-types
export interface TriggerType {
  type: string;
  label: string;
  configSchema: Record<string, unknown>;
}

// Discovery types returned by GET /api/v1/automation/action-types
export interface ActionType {
  type: string;
  label: string;
  category: string;
  configSchema: Record<string, unknown>;
}

// Payload shapes for mutation endpoints
export interface CreateAutomationPayload {
  name: string;
  automationType: AutomationType;
  icon?: string | null;
  trigger: {
    triggerType: string;
    config: Record<string, unknown>;
  } | null;
  actions: Array<{
    actionType: string;
    position: number;
    config: Record<string, unknown>;
  }>;
}

export interface UpdateAutomationPayload {
  name?: string;
  isEnabled?: boolean;
  icon?: string | null;
  trigger?: {
    triggerType: string;
    config: Record<string, unknown>;
  };
  actions?: Array<{
    actionType: string;
    position: number;
    config: Record<string, unknown>;
  }>;
}

// UI tab state for AutomationPanel
export type AutomationTab = 'rules' | 'buttons' | 'schedule' | 'log';

// Result returned by POST .../automation-buttons/:automationId/run (card)
export interface CardButtonRunResult {
  runLogId: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
}

// Result returned by POST /boards/:boardId/automation-buttons/:automationId/run
export interface BoardButtonRunResult {
  runLogId: string | null;
  cardCount: number;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
}

// Run log entry returned by GET .../runs
export type RunStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED';

export interface AutomationRunLog {
  id: string;
  automationId: string;
  automationName: string;
  automationType?: AutomationType;
  status: RunStatus;
  cardId?: string | null;
  cardName?: string | null;
  triggeredByUser?: { id: string; name: string } | null;
  ranAt: string;
  context: Record<string, unknown>;
  errorMessage?: string | null;
}

export interface PaginatedRunLogs {
  data: AutomationRunLog[];
  metadata: {
    totalPage: number;
    perPage: number;
  };
}

// Quota returned by GET /boards/:boardId/automation-quota
export interface AutomationQuota {
  usedRuns: number;
  maxRuns: number;
  resetAt: string;
  percentUsed: number;
}
