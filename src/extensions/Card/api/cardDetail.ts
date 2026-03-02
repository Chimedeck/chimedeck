// cardDetail API — thin wrappers used by the CardModal container.
// Re-exports are handled in the main api.ts; these wrappers accept the injected
// __api__ object directly so no import cycle is introduced.

export type ApiClient = {
  get: <T>(url: string) => Promise<T>;
  post: <T>(url: string, data: unknown) => Promise<T>;
  patch: <T>(url: string, data?: unknown) => Promise<T>;
  delete: <T>(url: string) => Promise<T>;
};

import type { Card, ChecklistItem, Label } from '../api';

export async function patchCard({
  api,
  cardId,
  fields,
}: {
  api: ApiClient;
  cardId: string;
  fields: Partial<Pick<Card, 'title' | 'description' | 'due_date' | 'archived'>>;
}): Promise<{ data: Card }> {
  return api.patch<{ data: Card }>(`/api/v1/cards/${cardId}`, fields);
}

export async function archiveCardToggle({
  api,
  cardId,
}: {
  api: ApiClient;
  cardId: string;
}): Promise<{ data: Card }> {
  return api.patch<{ data: Card }>(`/api/v1/cards/${cardId}/archive`);
}

export async function postChecklistItem({
  api,
  cardId,
  title,
}: {
  api: ApiClient;
  cardId: string;
  title: string;
}): Promise<{ data: ChecklistItem }> {
  return api.post<{ data: ChecklistItem }>(`/api/v1/cards/${cardId}/checklist`, { title });
}

export async function patchChecklistItem({
  api,
  itemId,
  fields,
}: {
  api: ApiClient;
  itemId: string;
  fields: Partial<Pick<ChecklistItem, 'title' | 'checked'>>;
}): Promise<{ data: ChecklistItem }> {
  return api.patch<{ data: ChecklistItem }>(`/api/v1/checklist-items/${itemId}`, fields);
}

export async function deleteChecklistItemById({
  api,
  itemId,
}: {
  api: ApiClient;
  itemId: string;
}): Promise<void> {
  return api.delete(`/api/v1/checklist-items/${itemId}`);
}

export async function postLabelAssign({
  api,
  cardId,
  labelId,
}: {
  api: ApiClient;
  cardId: string;
  labelId: string;
}): Promise<void> {
  await api.post(`/api/v1/cards/${cardId}/labels`, { labelId });
}

export async function deleteLabelAssign({
  api,
  cardId,
  labelId,
}: {
  api: ApiClient;
  cardId: string;
  labelId: string;
}): Promise<void> {
  await api.delete(`/api/v1/cards/${cardId}/labels/${labelId}`);
}

export async function postMemberAssign({
  api,
  cardId,
  userId,
}: {
  api: ApiClient;
  cardId: string;
  userId: string;
}): Promise<void> {
  await api.post(`/api/v1/cards/${cardId}/members`, { userId });
}

export async function deleteMemberAssign({
  api,
  cardId,
  userId,
}: {
  api: ApiClient;
  cardId: string;
  userId: string;
}): Promise<void> {
  await api.delete(`/api/v1/cards/${cardId}/members/${userId}`);
}

export async function createBoardLabel({
  api,
  boardId,
  name,
  color,
}: {
  api: ApiClient;
  boardId: string;
  name: string;
  color: string;
}): Promise<{ data: Label }> {
  return api.post<{ data: Label }>(`/api/v1/boards/${boardId}/labels`, { name, color });
}

export async function getBoardLabels({
  api,
  boardId,
}: {
  api: ApiClient;
  boardId: string;
}): Promise<{ data: Label[] }> {
  return api.get<{ data: Label[] }>(`/api/v1/boards/${boardId}/labels`);
}

export async function getBoardMembers({
  api,
  boardId,
}: {
  api: ApiClient;
  boardId: string;
}): Promise<{ data: Array<{ id: string; email: string; display_name: string | null }> }> {
  return api.get(`/api/v1/boards/${boardId}/members`);
}
