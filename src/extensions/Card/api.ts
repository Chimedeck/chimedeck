// Client API for all card-related endpoints.

export interface Card {
  id: string;
  list_id: string;
  title: string;
  description: string | null;
  position: string;
  archived: boolean;
  due_date: string | null;
  due_complete: boolean;
  start_date: string | null;
  amount: string | null;
  currency: string | null;
  cover_attachment_id?: string | null;
  cover_color?: string | null;
  cover_size?: 'SMALL' | 'FULL';
  cover_image_url?: string | null;
  created_at: string;
  updated_at: string;
  labels: Array<{ id: string; name: string; color: string }>;
  members: Array<{ id: string; email: string; name: string | null; avatar_url?: string | null }>;
  /** Counts returned by the board list endpoint — may be absent on older cached responses. */
  comment_count?: number;
  attachment_count?: number;
  /** Count of internal card-link attachments — separate from file/URL attachments. */
  linked_card_count?: number;
  checklist_total?: number;
  checklist_done?: number;
}

export interface Label {
  id: string;
  board_id: string;
  name: string;
  color: string; // hex e.g. "#FF5733"
}

export interface CardMember {
  id: string;
  email: string;
  name: string | null;
  avatar_url?: string | null;
}

export interface ChecklistItem {
  id: string;
  card_id: string;
  checklist_id: string | null;
  title: string;
  checked: boolean;
  position: string;
  assigned_member_id?: string | null;
  due_date?: string | null;
  linked_card_id?: string | null;
}

export interface Checklist {
  id: string;
  card_id: string;
  title: string;
  position: string;
  items: ChecklistItem[];
}

export interface CardDetail extends Card {
  includes: {
    list: { id: string; title: string; board_id: string; position: string; archived: boolean };
    board: { id: string; title: string };
    labels: Label[];
    members: CardMember[];
    checklists: Checklist[];
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
  return api.get<{ data: Card[] }>(`/lists/${listId}/cards`);
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
  return api.post<{ data: Card }>(`/lists/${listId}/cards`, { title, description });
}

export async function getCard({
  api,
  cardId,
}: {
  api: { get: <T>(url: string) => Promise<T> };
  cardId: string;
}): Promise<{ data: Card; includes: CardDetail['includes'] }> {
  return api.get<{ data: Card; includes: CardDetail['includes'] }>(`/cards/${cardId}`);
}

export async function updateCard({
  api,
  cardId,
  title,
  description,
  due_date,
  cover_attachment_id,
  cover_color,
  cover_size,
}: {
  api: { patch: <T>(url: string, data: unknown) => Promise<T> };
  cardId: string;
  title?: string;
  description?: string;
  due_date?: string | null;
  cover_attachment_id?: string | null;
  cover_color?: string | null;
  cover_size?: 'SMALL' | 'FULL';
}): Promise<{ data: Card }> {
  return api.patch<{ data: Card }>(`/cards/${cardId}`, {
    title,
    description,
    due_date,
    cover_attachment_id,
    cover_color,
    cover_size,
  });
}

export async function archiveCard({
  api,
  cardId,
}: {
  api: { patch: <T>(url: string) => Promise<T> };
  cardId: string;
}): Promise<{ data: Card }> {
  return api.patch<{ data: Card }>(`/cards/${cardId}/archive`);
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
  return api.post<{ data: Card }>(`/cards/${cardId}/move`, { targetListId, afterCardId });
}

export async function duplicateCard({
  api,
  cardId,
}: {
  api: { post: <T>(url: string, data: unknown) => Promise<T> };
  cardId: string;
}): Promise<{ data: Card }> {
  return api.post<{ data: Card }>(`/cards/${cardId}/duplicate`, {});
}

export async function copyCard({
  api,
  cardId,
  targetListId,
  position,
  title,
  keepChecklists,
  keepMembers,
}: {
  api: { post: <T>(url: string, data: unknown) => Promise<T> };
  cardId: string;
  targetListId: string;
  position?: number;
  title?: string;
  keepChecklists?: boolean;
  keepMembers?: boolean;
}): Promise<{ data: Card }> {
  return api.post<{ data: Card }>(`/cards/${cardId}/copy`, {
    targetListId,
    position,
    title,
    keepChecklists,
    keepMembers,
  });
}

export async function deleteCard({
  api,
  cardId,
}: {
  api: { delete: <T>(url: string) => Promise<T> };
  cardId: string;
}): Promise<void> {
  return api.delete(`/cards/${cardId}`);
}

// ---------- Labels ----------

export async function listLabels({
  api,
  boardId,
}: {
  api: { get: <T>(url: string) => Promise<T> };
  boardId: string;
}): Promise<{ data: Label[] }> {
  return api.get<{ data: Label[] }>(`/boards/${boardId}/labels`);
}

export async function createLabel({
  api,
  boardId,
  name,
  color,
}: {
  api: { post: <T>(url: string, data: unknown) => Promise<T> };
  boardId: string;
  name: string;
  color: string;
}): Promise<{ data: Label }> {
  return api.post<{ data: Label }>(`/boards/${boardId}/labels`, { name, color });
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
  return api.patch<{ data: Label }>(`/labels/${labelId}`, { name, color });
}

export async function deleteLabel({
  api,
  labelId,
}: {
  api: { delete: <T>(url: string) => Promise<T> };
  labelId: string;
}): Promise<void> {
  return api.delete(`/labels/${labelId}`);
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
  return api.post<{ data: { card_id: string; label_id: string } }>(`/cards/${cardId}/labels`, { labelId });
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
  return api.delete(`/cards/${cardId}/labels/${labelId}`);
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
  return api.post<{ data: { card_id: string; user_id: string } }>(`/cards/${cardId}/members`, { userId });
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
  return api.delete(`/cards/${cardId}/members/${userId}`);
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
  return api.post<{ data: ChecklistItem }>(`/cards/${cardId}/checklist`, { title });
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
  return api.patch<{ data: ChecklistItem }>(`/checklist-items/${itemId}`, { title, checked, position });
}

export async function deleteChecklistItem({
  api,
  itemId,
}: {
  api: { delete: <T>(url: string) => Promise<T> };
  itemId: string;
}): Promise<void> {
  return api.delete(`/checklist-items/${itemId}`);
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
  return api.get<{ data: Card[] }>(`/workspaces/${workspaceId}/cards/due?before=${encodeURIComponent(before)}`);
}
