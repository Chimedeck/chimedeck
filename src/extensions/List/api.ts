// Client API for all list-related endpoints.
import type { ListSortBy } from './types';

export interface List {
  id: string;
  boardId: string;
  title: string;
  position: string;
  archived: boolean;
  color?: string | null;
}

// ---------- List CRUD ----------

export async function listLists({
  api,
  boardId,
}: {
  api: { get: <T>(url: string) => Promise<T> };
  boardId: string;
}): Promise<{ data: List[] }> {
  return api.get<{ data: List[] }>(`/boards/${boardId}/lists`);
}

export async function createList({
  api,
  boardId,
  title,
  afterId,
}: {
  api: { post: <T>(url: string, data: unknown) => Promise<T> };
  boardId: string;
  title: string;
  afterId?: string | null;
}): Promise<{ data: List }> {
  return api.post<{ data: List }>(`/boards/${boardId}/lists`, { title, afterId });
}

export async function updateList({
  api,
  listId,
  title,
}: {
  api: { patch: <T>(url: string, data: unknown) => Promise<T> };
  listId: string;
  title: string;
}): Promise<{ data: List }> {
  return api.patch<{ data: List }>(`/lists/${listId}`, { title });
}

export async function archiveList({
  api,
  listId,
}: {
  api: { patch: <T>(url: string) => Promise<T> };
  listId: string;
}): Promise<{ data: List }> {
  return api.patch<{ data: List }>(`/lists/${listId}/archive`);
}

export async function deleteList({
  api,
  listId,
  confirm,
}: {
  api: { delete: <T>(url: string, config?: { data?: unknown }) => Promise<T> };
  listId: string;
  confirm?: boolean;
}): Promise<void> {
  return api.delete(`/lists/${listId}`, confirm ? { data: { confirm: true } } : undefined);
}

export async function reorderLists({
  api,
  boardId,
  order,
}: {
  api: { post: <T>(url: string, data: unknown) => Promise<T> };
  boardId: string;
  order: string[];
}): Promise<{ data: List[] }> {
  return api.post<{ data: List[] }>(`/boards/${boardId}/lists/reorder`, { order });
}

export async function sortListCards({
  api,
  listId,
  sortBy,
}: {
  api: { patch: <T>(url: string, data: unknown) => Promise<T> };
  listId: string;
  sortBy: ListSortBy;
}): Promise<{ data: Array<{ id: string; list_id: string; position: string }> }> {
  return api.patch<{ data: Array<{ id: string; list_id: string; position: string }> }>(
    `/lists/${listId}/sort`,
    { sortBy },
  );
}

export async function updateListColor({
  api,
  listId,
  color,
}: {
  api: { patch: <T>(url: string, data: unknown) => Promise<T> };
  listId: string;
  color: string | null;
}): Promise<{ data: List }> {
  return api.patch<{ data: List }>(`/lists/${listId}/color`, { color });
}
