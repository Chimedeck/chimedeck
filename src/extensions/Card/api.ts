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

export interface CardDetail extends Card {
  includes: {
    list: { id: string; title: string; board_id: string; position: string; archived: boolean };
    board: { id: string; title: string };
    labels: unknown[];
    members: unknown[];
    checklistItems: unknown[];
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
