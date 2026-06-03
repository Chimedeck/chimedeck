// Client API helpers for board chat settings and runtime access controls.
// Sprint 165: chat permission toggles (guest_can_view / guest_can_use).

export interface BoardChatPermissions {
  board_id: string;
  guest_can_view: boolean;
  guest_can_use: boolean;
  updated_at: string;
}

export interface BoardChatMessage {
  id: string;
  thread_id: string;
  board_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  userName: string;
  avatar: string | null;
}

export interface PatchBoardChatPermissionsBody {
  guest_can_view?: boolean;
  guest_can_use?: boolean;
}

export async function getBoardChatPermissions({
  api,
  boardId,
}: {
  api: { get: <T>(url: string) => Promise<T> };
  boardId: string;
}): Promise<{ data: BoardChatPermissions }> {
  return api.get<{ data: BoardChatPermissions }>(`/boards/${boardId}/chat-permissions`);
}

export async function patchBoardChatPermissions({
  api,
  boardId,
  body,
}: {
  api: { patch: <T>(url: string, data: unknown) => Promise<T> };
  boardId: string;
  body: PatchBoardChatPermissionsBody;
}): Promise<{ data: BoardChatPermissions }> {
  return api.patch<{ data: BoardChatPermissions }>(`/boards/${boardId}/chat-permissions`, body);
}

export async function getBoardChatMessages({
  api,
  boardId,
}: {
  api: { get: <T>(url: string) => Promise<T> };
  boardId: string;
}): Promise<{ data: BoardChatMessage[] }> {
  return api.get<{ data: BoardChatMessage[] }>(`/boards/${boardId}/chat/messages`);
}

export async function createBoardChatMessage({
  api,
  boardId,
  content,
}: {
  api: { post: <T>(url: string, data: unknown) => Promise<T> };
  boardId: string;
  content: string;
}): Promise<{ data: BoardChatMessage }> {
  return api.post<{ data: BoardChatMessage }>(`/boards/${boardId}/chat/messages`, { content });
}
