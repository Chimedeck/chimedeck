// Client API for all board-related endpoints.
// Callers must inject an axios-compatible `api` instance.

export type BoardState = 'ACTIVE' | 'ARCHIVED';

export interface Board {
  id: string;
  workspaceId: string;
  title: string;
  state: BoardState;
  createdAt: string;
}

// ---------- Board CRUD ----------

export async function listBoards({
  api,
  workspaceId,
}: {
  api: { get: <T>(url: string) => Promise<T> };
  workspaceId: string;
}): Promise<{ data: Board[] }> {
  return api.get<{ data: Board[] }>(`/api/v1/workspaces/${workspaceId}/boards`);
}

export async function getBoard({
  api,
  boardId,
}: {
  api: { get: <T>(url: string) => Promise<T> };
  boardId: string;
}): Promise<{ data: Board; includes: { lists: unknown[]; cards: unknown[] } }> {
  return api.get(`/api/v1/boards/${boardId}`);
}

export async function createBoard({
  api,
  workspaceId,
  title,
}: {
  api: { post: <T>(url: string, data: unknown) => Promise<T> };
  workspaceId: string;
  title: string;
}): Promise<{ data: Board }> {
  return api.post<{ data: Board }>(`/api/v1/workspaces/${workspaceId}/boards`, { title });
}

export async function updateBoard({
  api,
  boardId,
  title,
}: {
  api: { patch: <T>(url: string, data: unknown) => Promise<T> };
  boardId: string;
  title: string;
}): Promise<{ data: Board }> {
  return api.patch<{ data: Board }>(`/api/v1/boards/${boardId}`, { title });
}

export async function archiveBoard({
  api,
  boardId,
}: {
  api: { patch: <T>(url: string) => Promise<T> };
  boardId: string;
}): Promise<{ data: Board }> {
  return api.patch<{ data: Board }>(`/api/v1/boards/${boardId}/archive`);
}

export async function deleteBoard({
  api,
  boardId,
}: {
  api: { delete: <T>(url: string) => Promise<T> };
  boardId: string;
}): Promise<void> {
  return api.delete(`/api/v1/boards/${boardId}`);
}

export async function duplicateBoard({
  api,
  boardId,
}: {
  api: { post: <T>(url: string) => Promise<T> };
  boardId: string;
}): Promise<{ data: Board }> {
  return api.post<{ data: Board }>(`/api/v1/boards/${boardId}/duplicate`);
}
