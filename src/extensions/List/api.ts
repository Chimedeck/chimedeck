// Client API for all list-related endpoints.

export interface List {
  id: string;
  boardId: string;
  title: string;
  position: string;
  archived: boolean;
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
}: {
  api: { delete: <T>(url: string) => Promise<T> };
  listId: string;
}): Promise<void> {
  return api.delete(`/lists/${listId}`);
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
