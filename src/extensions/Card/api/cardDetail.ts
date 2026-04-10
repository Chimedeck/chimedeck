// cardDetail API — thin wrappers used by the CardModal container.
// Re-exports are handled in the main api.ts; these wrappers accept the injected
// __api__ object directly so no import cycle is introduced.

export type ApiClient = {
  get: <T>(url: string) => Promise<T>;
  post: <T>(url: string, data: unknown) => Promise<T>;
  patch: <T>(url: string, data?: unknown) => Promise<T>;
  delete: <T>(url: string) => Promise<T>;
};

import type { Card, ChecklistItem, Checklist, Label, CardMember } from '../api';

// NOTE: The apiClient interceptor auto-unwraps response.data, so all API calls
// return the inner payload directly (e.g. Card, not { data: Card }).

export async function patchCard({
  api,
  cardId,
  fields,
}: {
  api: ApiClient;
  cardId: string;
  // amount is number | null at the API boundary (server enforces numeric)
  fields: Partial<Omit<Pick<Card, 'title' | 'description' | 'due_date' | 'due_complete' | 'start_date' | 'archived' | 'amount' | 'currency' | 'cover_attachment_id' | 'cover_color' | 'cover_size'>, 'amount'>> & { amount?: number | null };
}): Promise<Card> {
  const res = await api.patch<{ data: Card }>(`/cards/${cardId}`, fields);
  // interceptor returns { data: Card } as the resolved value
  return (res as unknown as { data: Card }).data;
}

export async function archiveCardToggle({
  api,
  cardId,
}: {
  api: ApiClient;
  cardId: string;
}): Promise<Card> {
  const res = await api.patch<{ data: Card }>(`/cards/${cardId}/archive`);
  return (res as unknown as { data: Card }).data;
}

export async function postChecklistItem({
  api,
  cardId,
  title,
}: {
  api: ApiClient;
  cardId: string;
  title: string;
}): Promise<ChecklistItem> {
  const res = await api.post<{ data: ChecklistItem }>(`/cards/${cardId}/checklist`, { title });
  return (res as unknown as { data: ChecklistItem }).data;
}

export async function patchChecklistItem({
  api,
  itemId,
  fields,
}: {
  api: ApiClient;
  itemId: string;
  fields: Partial<Pick<ChecklistItem, 'title' | 'checked' | 'assigned_member_id' | 'due_date' | 'position'>>;
}): Promise<ChecklistItem> {
  const res = await api.patch<{ data: ChecklistItem }>(`/checklist-items/${itemId}`, fields);
  return (res as unknown as { data: ChecklistItem }).data;
}

export async function convertChecklistItemToCard({
  api,
  itemId,
}: {
  api: ApiClient;
  itemId: string;
}): Promise<{ card: Card; removedItemId: string; removedChecklistId: string | null }> {
  const res = await api.post<{ data: { card: Card; removedItemId: string; removedChecklistId: string | null } }>(`/checklist-items/${itemId}/convert`, {});
  return (res as unknown as { data: { card: Card; removedItemId: string; removedChecklistId: string | null } }).data;
}

export async function deleteChecklistItemById({
  api,
  itemId,
}: {
  api: ApiClient;
  itemId: string;
}): Promise<void> {
  return api.delete(`/checklist-items/${itemId}`);
}

export async function createChecklist({
  api,
  cardId,
  title,
}: {
  api: ApiClient;
  cardId: string;
  title?: string;
}): Promise<Checklist> {
  const res = await api.post<{ data: Checklist }>(`/cards/${cardId}/checklists`, { title: title || 'Checklist' });
  return (res as unknown as { data: Checklist }).data;
}

export async function patchChecklist({
  api,
  checklistId,
  title,
}: {
  api: ApiClient;
  checklistId: string;
  title: string;
}): Promise<Checklist> {
  const res = await api.patch<{ data: Checklist }>(`/checklists/${checklistId}`, { title });
  return (res as unknown as { data: Checklist }).data;
}

export async function deleteChecklistById({
  api,
  checklistId,
}: {
  api: ApiClient;
  checklistId: string;
}): Promise<void> {
  return api.delete(`/checklists/${checklistId}`);
}

export async function postChecklistItemInGroup({
  api,
  checklistId,
  title,
}: {
  api: ApiClient;
  checklistId: string;
  title: string;
}): Promise<ChecklistItem> {
  const res = await api.post<{ data: ChecklistItem }>(`/checklists/${checklistId}/items`, { title });
  return (res as unknown as { data: ChecklistItem }).data;
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
  await api.post(`/cards/${cardId}/labels`, { labelId });
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
  await api.delete(`/cards/${cardId}/labels/${labelId}`);
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
  await api.post(`/cards/${cardId}/members`, { userId });
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
  await api.delete(`/cards/${cardId}/members/${userId}`);
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
}): Promise<Label> {
  const res = await api.post<{ data: Label }>(`/boards/${boardId}/labels`, { name, color });
  return (res as unknown as { data: Label }).data;
}

export async function updateBoardLabel({
  api,
  labelId,
  name,
  color,
}: {
  api: ApiClient;
  labelId: string;
  name: string;
  color: string;
}): Promise<Label> {
  const res = await api.patch<{ data: Label }>(`/labels/${labelId}`, { name, color });
  return (res as unknown as { data: Label }).data;
}

export async function getBoardLabels({
  api,
  boardId,
}: {
  api: ApiClient;
  boardId: string;
}): Promise<Label[]> {
  const res = await api.get<{ data: Label[] }>(`/boards/${boardId}/labels`);
  return (res as unknown as { data: Label[] }).data;
}

export async function getBoardMembers({
  api,
  boardId,
}: {
  api: ApiClient;
  boardId: string;
}): Promise<CardMember[]> {
  const res = await api.get<{ data: Array<{ user_id: string; email: string; display_name: string | null; avatar_url?: string | null }> }>(`/boards/${boardId}/members`);
  return (res as unknown as { data: Array<{ user_id: string; email: string; display_name: string | null; avatar_url?: string | null }> }).data.map((m) => ({
    id: m.user_id,
    email: m.email,
    name: m.display_name,
    avatar_url: m.avatar_url ?? null,
  }));
}

// ── Comment API ────────────────────────────────────────────────────────────────

export interface ReactionSummary {
  emoji: string;
  count: number;
  reactedByMe: boolean;
  reactors?: Array<{ userId: string; name: string | null }>;
}

export interface CommentData {
  id: string;
  card_id: string;
  user_id: string;
  content: string;
  version: number;
  deleted: boolean;
  created_at: string;
  updated_at: string;
  author_name?: string | null;
  author_email?: string | null;
  author_avatar_url?: string | null;
  reactions?: ReactionSummary[];
  parent_id?: string | null;
  reply_count?: number;
}

export async function getCardComments({
  api,
  cardId,
}: {
  api: ApiClient;
  cardId: string;
}): Promise<CommentData[]> {
  const res = await api.get<{ data: CommentData[] }>(`/cards/${cardId}/comments`);
  return (res as unknown as { data: CommentData[] }).data;
}

export async function postCardComment({
  api,
  cardId,
  content,
}: {
  api: ApiClient;
  cardId: string;
  content: string;
}): Promise<CommentData> {
  const res = await api.post<{ data: CommentData }>(`/cards/${cardId}/comments`, { content });
  return (res as unknown as { data: CommentData }).data;
}

export async function patchComment({
  api,
  commentId,
  content,
}: {
  api: ApiClient;
  commentId: string;
  content: string;
}): Promise<CommentData> {
  const res = await api.patch<{ data: CommentData }>(`/comments/${commentId}`, { content });
  return (res as unknown as { data: CommentData }).data;
}

export async function deleteComment({
  api,
  commentId,
}: {
  api: ApiClient;
  commentId: string;
}): Promise<void> {
  await api.delete(`/comments/${commentId}`);
}
