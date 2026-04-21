// Client API for all board-related endpoints.
// Callers must inject an axios-compatible `api` instance.

export type BoardState = 'ACTIVE' | 'ARCHIVED';
export type BoardVisibility = 'PUBLIC' | 'PRIVATE' | 'WORKSPACE';

export interface Board {
  id: string;
  short_id?: string;
  workspaceId: string;
  title: string;
  state: BoardState;
  visibility: BoardVisibility;
  createdAt: string;
  isStarred?: boolean;
  background?: string | null;
  /** Sub-type of the caller's GUEST role on this board. null when caller is a
   *  regular workspace member (OWNER/ADMIN/MEMBER/VIEWER). */
  callerGuestType?: 'VIEWER' | 'MEMBER' | null;
}

export interface ListCardHydration {
  loaded: number;
  total: number;
  hasMore: boolean;
  nextOffset: number | null;
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
  initialCardsPerList,
}: {
  api: { get: <T>(url: string) => Promise<T> };
  boardId: string;
  initialCardsPerList?: number;
}): Promise<{
  data: Board;
  includes: {
    lists: unknown[];
    cards: unknown[];
    card_hydration?: Record<string, ListCardHydration>;
  };
}> {
  const params =
    typeof initialCardsPerList === 'number' && initialCardsPerList > 0
      ? `?initialCardsPerList=${encodeURIComponent(String(initialCardsPerList))}`
      : '';
  return api.get(`/boards/${boardId}${params}`);
}

export async function listCardsByListBatch({
  api,
  listId,
  limit,
  offset,
}: {
  api: { get: <T>(url: string) => Promise<T> };
  listId: string;
  limit: number;
  offset: number;
}): Promise<{
  data: unknown[];
  metadata: {
    total: number;
    limit: number;
    offset: number;
    nextOffset: number | null;
    hasMore: boolean;
  };
}> {
  return api.get(
    `/lists/${listId}/cards?limit=${encodeURIComponent(String(limit))}&offset=${encodeURIComponent(String(offset))}`,
  );
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

// 409 Conflict payload returned when deleting a non-empty board without `confirm: true`.
export interface BoardDeleteConflictError {
  name: 'delete-requires-confirmation';
  data: { listCount: number; cardCount: number };
}

export async function deleteBoard({
  api,
  boardId,
  confirm,
}: {
  api: { delete: <T>(url: string, config?: { data?: unknown }) => Promise<T> };
  boardId: string;
  confirm?: boolean;
}): Promise<void> {
  return api.delete(`/boards/${boardId}`, confirm ? { data: { confirm: true } } : undefined);
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

// POST /api/v1/boards/:id/background — upload a background image (multipart).
// Only JPEG/PNG, max 10 MB; caller must be Owner/Admin.
export async function uploadBoardBackground({
  boardId,
  file,
  token,
}: {
  boardId: string;
  file: File;
  token: string;
}): Promise<{ data: Board }> {
  const formData = new FormData();
  formData.append('background', file);
  const res = await fetch(`/api/v1/boards/${boardId}/background`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw err;
  }
  return res.json() as Promise<{ data: Board }>;
}

// DELETE /api/v1/boards/:id/background — remove board background.
// Caller must be Owner/Admin.
export async function deleteBoardBackground({
  boardId,
  token,
}: {
  boardId: string;
  token: string;
}): Promise<{ data: Board }> {
  const res = await fetch(`/api/v1/boards/${boardId}/background`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw err;
  }
  return res.json() as Promise<{ data: Board }>;
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
