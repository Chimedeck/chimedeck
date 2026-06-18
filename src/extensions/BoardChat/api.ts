// Client API helpers for board chat settings and runtime access controls.
// Sprint 165: chat permission toggles (guest_can_view / guest_can_use).
// Sprint 199: session-scoped chat — all message/assist calls now require sessionId.

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
  author_id: string | null;
  content: string;
  is_assistant: boolean;
  created_at: string;
  updated_at: string;
  userName: string;
  avatar: string | null;
}

export interface BoardChatSession {
  id: string;
  board_id: string;
  name: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
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
  sessionId,
}: {
  api: { get: <T>(url: string) => Promise<T> };
  boardId: string;
  sessionId?: string;
}): Promise<{ data: BoardChatMessage[] }> {
  const params = new URLSearchParams();
  if (sessionId) params.set('sessionId', sessionId);
  const qs = params.toString();
  const url = `/boards/${boardId}/chat/messages${qs ? '?' + qs : ''}`;
  return api.get<{ data: BoardChatMessage[] }>(url);
}

// Sprint 199 — session-scoped: all message posting requires a sessionId.
export async function createBoardChatMessage({
  api,
  boardId,
  sessionId,
  content,
}: {
  api: { post: <T>(url: string, data: unknown) => Promise<T> };
  boardId: string;
  sessionId: string;
  content: string;
}): Promise<{ data: BoardChatMessage }> {
  return api.post<{ data: BoardChatMessage }>(`/boards/${boardId}/chat/messages`, {
    content,
    sessionId,
  });
}

// ---- Sessions (Sprint 199) ----

export async function createBoardChatSession({
  api,
  boardId,
  name,
}: {
  api: { post: <T>(url: string, data: unknown) => Promise<T> };
  boardId: string;
  name?: string;
}): Promise<{ data: BoardChatSession }> {
  return api.post<{ data: BoardChatSession }>(`/boards/${boardId}/chat/sessions`, { name });
}

export async function listBoardChatSessions({
  api,
  boardId,
}: {
  api: { get: <T>(url: string) => Promise<T> };
  boardId: string;
}): Promise<{ data: BoardChatSession[] }> {
  return api.get<{ data: BoardChatSession[] }>(`/boards/${boardId}/chat/sessions`);
}

export async function getBoardChatSession({
  api,
  boardId,
  sessionId,
}: {
  api: { get: <T>(url: string) => Promise<T> };
  boardId: string;
  sessionId: string;
}): Promise<{ data: BoardChatSession }> {
  return api.get<{ data: BoardChatSession }>(`/boards/${boardId}/chat/sessions/${sessionId}`);
}

export async function updateBoardChatSession({
  api,
  boardId,
  sessionId,
  name,
}: {
  api: { patch: <T>(url: string, data: unknown) => Promise<T> };
  boardId: string;
  sessionId: string;
  name?: string;
}): Promise<{ data: BoardChatSession }> {
  return api.patch<{ data: BoardChatSession }>(`/boards/${boardId}/chat/sessions/${sessionId}`, {
    name,
  });
}

export interface BoardChatAssistActionCard {
  state: 'suggested' | 'confirmed' | 'dismissed';
  toolName: string;
  toolCallId: string;
  idempotencyKey: string;
  source: 'board-chat-assist';
  boardId: string;
  workspaceId: string;
  cardId?: string;
  cardTitle?: string;
  listId?: string;
  listName?: string | null;
  documentPath?: string;
  documentContent?: string;
  commitMessage?: string;
}

export interface BoardChatAssistResponse {
  model: string;
  message?: string;
  actionCard?: BoardChatAssistActionCard;
  actionCards?: BoardChatAssistActionCard[];
}

export async function requestBoardChatAssist({
  api,
  boardId,
  sessionId,
  prompt,
}: {
  api: { post: <T>(url: string, data: unknown) => Promise<T> };
  boardId: string;
  sessionId: string;
  prompt: string;
}): Promise<{ data: BoardChatAssistResponse }> {
  return api.post<{ data: BoardChatAssistResponse }>(`/boards/${boardId}/chat/assist`, {
    prompt,
    sessionId,
  });
}

export interface BoardChatAssistCommitProposal {
  toolCallId: string;
  idempotencyKey: string;
  path: string;
  content: string;
  commitMessage: string;
}

export interface BoardChatAssistCommitResponse {
  committed: Array<{
    path: string;
    commitHash: string;
    actionCard: BoardChatAssistActionCard;
  }>;
  errors: Array<{
    path: string;
    name: string;
    message: string;
  }>;
}

export async function commitBoardChatProposals({
  api,
  boardId,
  sessionId,
  proposals,
}: {
  api: { post: <T>(url: string, data: unknown) => Promise<T> };
  boardId: string;
  sessionId: string;
  proposals: BoardChatAssistCommitProposal[];
}): Promise<{ data: BoardChatAssistCommitResponse }> {
  return api.post<{ data: BoardChatAssistCommitResponse }>(
    `/boards/${boardId}/chat/assist/commit`,
    { proposals, sessionId }
  );
}
