// Client API for all card-related endpoints.

export interface Card {
  id: string;
  list_id: string;
  title: string;
  description: string | null;
  position: string;
  archived: boolean;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Label {
  id: string;
  workspace_id: string;
  name: string;
  color: string; // hex e.g. "#FF5733"
}

export interface CardMember {
  id: string;
  email: string;
  display_name: string | null;
}

export interface ChecklistItem {
  id: string;
  card_id: string;
  title: string;
  checked: boolean;
  position: string;
}

export interface CardDetail extends Card {
  includes: {
    list: { id: string; title: string; board_id: string; position: string; archived: boolean };
    board: { id: string; title: string };
    labels: Label[];
    members: CardMember[];
    checklistItems: ChecklistItem[];
    comments: unknown[];
    attachments: unknown[];
    activities: unknown[];
  };
}

// ---------- Card CRUD ----------

export async function listCards({
  api,
  listId,
}: {
  api: { get: <T>(url: string) => Promise<T> };
  listId: string;
}): Promise<{ data: Card[] }> {
  return api.get<{ data: Card[] }>(`/api/v1/lists/${listId}/cards`);
}

export async function createCard({
  api,
  listId,
  title,
  description,
}: {
  api: { post: <T>(url: string, data: unknown) => Promise<T> };
  listId: string;
  title: string;
  description?: string;
}): Promise<{ data: Card }> {
  return api.post<{ data: Card }>(`/api/v1/lists/${listId}/cards`, { title, description });
}

export async function getCard({
  api,
  cardId,
}: {
  api: { get: <T>(url: string) => Promise<T> };
  cardId: string;
}): Promise<{ data: Card; includes: CardDetail['includes'] }> {
  return api.get<{ data: Card; includes: CardDetail['includes'] }>(`/api/v1/cards/${cardId}`);
}

export async function updateCard({
  api,
  cardId,
  title,
  description,
  due_date,
}: {
  api: { patch: <T>(url: string, data: unknown) => Promise<T> };
  cardId: string;
  title?: string;
  description?: string;
  due_date?: string | null;
}): Promise<{ data: Card }> {
  return api.patch<{ data: Card }>(`/api/v1/cards/${cardId}`, { title, description, due_date });
}

export async function archiveCard({
  api,
  cardId,
}: {
  api: { patch: <T>(url: string) => Promise<T> };
  cardId: string;
}): Promise<{ data: Card }> {
  return api.patch<{ data: Card }>(`/api/v1/cards/${cardId}/archive`);
}

export async function moveCard({
  api,
  cardId,
  targetListId,
  afterCardId,
}: {
  api: { post: <T>(url: string, data: unknown) => Promise<T> };
  cardId: string;
  targetListId: string;
  afterCardId?: string | null;
}): Promise<{ data: Card }> {
  return api.post<{ data: Card }>(`/api/v1/cards/${cardId}/move`, { targetListId, afterCardId });
}

export async function duplicateCard({
  api,
  cardId,
}: {
  api: { post: <T>(url: string, data: unknown) => Promise<T> };
  cardId: string;
}): Promise<{ data: Card }> {
  return api.post<{ data: Card }>(`/api/v1/cards/${cardId}/duplicate`, {});
}

export async function deleteCard({
  api,
  cardId,
}: {
  api: { delete: <T>(url: string) => Promise<T> };
  cardId: string;
}): Promise<void> {
  return api.delete(`/api/v1/cards/${cardId}`);
}

// ---------- Labels ----------

export async function listLabels({
  api,
  workspaceId,
}: {
  api: { get: <T>(url: string) => Promise<T> };
  workspaceId: string;
}): Promise<{ data: Label[] }> {
  return api.get<{ data: Label[] }>(`/api/v1/workspaces/${workspaceId}/labels`);
}

export async function createLabel({
  api,
  workspaceId,
  name,
  color,
}: {
  api: { post: <T>(url: string, data: unknown) => Promise<T> };
  workspaceId: string;
  name: string;
  color: string;
}): Promise<{ data: Label }> {
  return api.post<{ data: Label }>(`/api/v1/workspaces/${workspaceId}/labels`, { name, color });
}

export async function updateLabel({
  api,
  labelId,
  name,
  color,
}: {
  api: { patch: <T>(url: string, data: unknown) => Promise<T> };
  labelId: string;
  name?: string;
  color?: string;
}): Promise<{ data: Label }> {
  return api.patch<{ data: Label }>(`/api/v1/labels/${labelId}`, { name, color });
}

export async function deleteLabel({
  api,
  labelId,
}: {
  api: { delete: <T>(url: string) => Promise<T> };
  labelId: string;
}): Promise<void> {
  return api.delete(`/api/v1/labels/${labelId}`);
}

export async function attachLabel({
  api,
  cardId,
  labelId,
}: {
  api: { post: <T>(url: string, data: unknown) => Promise<T> };
  cardId: string;
  labelId: string;
}): Promise<{ data: { card_id: string; label_id: string } }> {
  return api.post<{ data: { card_id: string; label_id: string } }>(`/api/v1/cards/${cardId}/labels`, { labelId });
}

export async function detachLabel({
  api,
  cardId,
  labelId,
}: {
  api: { delete: <T>(url: string) => Promise<T> };
  cardId: string;
  labelId: string;
}): Promise<void> {
  return api.delete(`/api/v1/cards/${cardId}/labels/${labelId}`);
}

// ---------- Members ----------

export async function assignMember({
  api,
  cardId,
  userId,
}: {
  api: { post: <T>(url: string, data: unknown) => Promise<T> };
  cardId: string;
  userId: string;
}): Promise<{ data: { card_id: string; user_id: string } }> {
  return api.post<{ data: { card_id: string; user_id: string } }>(`/api/v1/cards/${cardId}/members`, { userId });
}

export async function removeMember({
  api,
  cardId,
  userId,
}: {
  api: { delete: <T>(url: string) => Promise<T> };
  cardId: string;
  userId: string;
}): Promise<void> {
  return api.delete(`/api/v1/cards/${cardId}/members/${userId}`);
}

// ---------- Checklist ----------

export async function createChecklistItem({
  api,
  cardId,
  title,
}: {
  api: { post: <T>(url: string, data: unknown) => Promise<T> };
  cardId: string;
  title: string;
}): Promise<{ data: ChecklistItem }> {
  return api.post<{ data: ChecklistItem }>(`/api/v1/cards/${cardId}/checklist`, { title });
}

export async function updateChecklistItem({
  api,
  itemId,
  title,
  checked,
  position,
}: {
  api: { patch: <T>(url: string, data: unknown) => Promise<T> };
  itemId: string;
  title?: string;
  checked?: boolean;
  position?: string;
}): Promise<{ data: ChecklistItem }> {
  return api.patch<{ data: ChecklistItem }>(`/api/v1/checklist-items/${itemId}`, { title, checked, position });
}

export async function deleteChecklistItem({
  api,
  itemId,
}: {
  api: { delete: <T>(url: string) => Promise<T> };
  itemId: string;
}): Promise<void> {
  return api.delete(`/api/v1/checklist-items/${itemId}`);
}

// ---------- Due date query ----------

export async function listDueCards({
  api,
  workspaceId,
  before,
}: {
  api: { get: <T>(url: string) => Promise<T> };
  workspaceId: string;
  before: string; // ISO 8601
}): Promise<{ data: Card[] }> {
  return api.get<{ data: Card[] }>(`/api/v1/workspaces/${workspaceId}/cards/due?before=${encodeURIComponent(before)}`);
}
