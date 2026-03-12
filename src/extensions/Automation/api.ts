// Automation client API — wraps all automation REST endpoints.
// Follows the same pattern as other extension API modules (apiClient + typed functions).
import { apiClient } from '~/common/api/client';
import type {
  Automation,
  TriggerType,
  ActionType,
  CreateAutomationPayload,
  UpdateAutomationPayload,
  CardButtonRunResult,
  BoardButtonRunResult,
  PaginatedRunLogs,
  AutomationQuota,
} from './types';

type Api = typeof apiClient;

export async function getAutomations({
  boardId,
}: {
  boardId: string;
}): Promise<{ data: Automation[] }> {
  return apiClient.get(`/boards/${boardId}/automations`);
}

export async function createAutomation({
  api = apiClient,
  boardId,
  payload,
}: {
  api?: Api;
  boardId: string;
  payload: CreateAutomationPayload;
}): Promise<{ data: Automation }> {
  return api.post(`/boards/${boardId}/automations`, payload);
}

export async function updateAutomation({
  api = apiClient,
  boardId,
  automationId,
  patch,
}: {
  api?: Api;
  boardId: string;
  automationId: string;
  patch: UpdateAutomationPayload;
}): Promise<{ data: Automation }> {
  return api.patch(`/boards/${boardId}/automations/${automationId}`, patch);
}

export async function deleteAutomation({
  api = apiClient,
  boardId,
  automationId,
}: {
  api?: Api;
  boardId: string;
  automationId: string;
}): Promise<void> {
  return api.delete(`/boards/${boardId}/automations/${automationId}`);
}

export async function getTriggerTypes(): Promise<{ data: TriggerType[] }> {
  return apiClient.get('/automation/trigger-types');
}

export async function getActionTypes(): Promise<{ data: ActionType[] }> {
  return apiClient.get('/automation/action-types');
}

export async function runCardButton({
  cardId,
  automationId,
}: {
  cardId: string;
  automationId: string;
}): Promise<{ data: CardButtonRunResult }> {
  return apiClient.post(`/cards/${cardId}/automation-buttons/${automationId}/run`, {});
}

export async function runBoardButton({
  boardId,
  automationId,
}: {
  boardId: string;
  automationId: string;
}): Promise<{ data: BoardButtonRunResult }> {
  return apiClient.post(`/boards/${boardId}/automation-buttons/${automationId}/run`, {});
}

// Run log — per-automation paginated list
export async function getAutomationRuns({
  boardId,
  automationId,
  params = {},
}: {
  boardId: string;
  automationId: string;
  params?: { page?: number; perPage?: number; status?: string };
}): Promise<PaginatedRunLogs> {
  return apiClient.get(`/boards/${boardId}/automations/${automationId}/runs`, { params });
}

// Run log — board-wide, last 200 runs
export async function getBoardRuns({
  boardId,
  params = {},
}: {
  boardId: string;
  params?: { page?: number; perPage?: number };
}): Promise<PaginatedRunLogs> {
  return apiClient.get(`/boards/${boardId}/automation-runs`, { params });
}


