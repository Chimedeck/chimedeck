// Client API for all board-related endpoints.
// Callers must inject an axios-compatible `api` instance.

export type BoardState = 'ACTIVE' | 'ARCHIVED';
export type BoardVisibility = 'PUBLIC' | 'PRIVATE' | 'WORKSPACE';

export interface Board {
  id: string;
  workspaceId: string;
  title: string;
  state: BoardState;
  visibility: BoardVisibility;
  createdAt: string;
  isStarred?: boolean;
}

// ---------- Board CRUD ----------

export async function listBoards({
  api,
  workspaceId,
}: {
  api: { get: <T>(url: string) => Promise<T> };
  workspaceId: string;
}): Promise<{ data: Board[] }> {
  return api.get<{ data: Board[] }>(`/workspaces/${workspaceId}/boards`);
}

export async function getBoard({
  api,
  boardId,
}: {
  api: { get: <T>(url: string) => Promise<T> };
  boardId: string;
}): Promise<{ data: Board; includes: { lists: unknown[]; cards: unknown[] } }> {
  return api.get(`/boards/${boardId}`);
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
  return api.post<{ data: Board }>(`/workspaces/${workspaceId}/boards`, { title });
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
  return api.patch<{ data: Board }>(`/boards/${boardId}`, { title });
}

export async function archiveBoard({
  api,
  boardId,
}: {
  api: { patch: <T>(url: string) => Promise<T> };
  boardId: string;
}): Promise<{ data: Board }> {
  return api.patch<{ data: Board }>(`/boards/${boardId}/archive`);
}

export async function deleteBoard({
  api,
  boardId,
}: {
  api: { delete: <T>(url: string) => Promise<T> };
  boardId: string;
}): Promise<void> {
  return api.delete(`/boards/${boardId}`);
}

export async function duplicateBoard({
  api,
  boardId,
}: {
  api: { post: <T>(url: string) => Promise<T> };
  boardId: string;
}): Promise<{ data: Board }> {
  return api.post<{ data: Board }>(`/boards/${boardId}/duplicate`);
}

export async function starBoard({
  api,
  boardId,
}: {
  api: { post: <T>(url: string, data: unknown) => Promise<T> };
  boardId: string;
}): Promise<void> {
  await api.post(`/boards/${boardId}/star`, {});
}

export async function unstarBoard({
  api,
  boardId,
}: {
  api: { delete: <T>(url: string) => Promise<T> };
  boardId: string;
}): Promise<void> {
  await api.delete(`/boards/${boardId}/star`);
}

// PATCH /api/v1/boards/:id — update board visibility field; min role: ADMIN.
export async function patchBoardVisibility({
  api,
  boardId,
  visibility,
}: {
  api: { patch: <T>(url: string, data: unknown) => Promise<T> };
  boardId: string;
  visibility: BoardVisibility;
}): Promise<{ data: Board }> {
  return api.patch<{ data: Board }>(`/boards/${boardId}`, { visibility });
}
