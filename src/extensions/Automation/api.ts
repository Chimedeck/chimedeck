// Automation client API — wraps all automation REST endpoints.
// Follows the same pattern as other extension API modules (apiClient + typed functions).
import { apiClient } from '~/common/api/client';
import type {
  Automation,
  TriggerType,
  ActionType,
  CreateAutomationPayload,
  UpdateAutomationPayload,
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
