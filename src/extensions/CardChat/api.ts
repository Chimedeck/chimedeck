// Client API helpers for card-scoped chat (Sprint 171).
// Follows the BoardChat/api.ts pattern: destructured { api, cardId, ... } args.

export interface CardChatSession {
  id: string;
  card_id: string;
  workspace_id: string;
  created_by: string;
  status: 'IDLE' | 'ACTIVE_REFINEMENT' | 'PAUSED' | 'READY_FOR_REVIEW';
  quality_score: number | null;
  last_actor_at: string;
  created_at: string;
  updated_at: string;
}

export interface CardChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  metadata: string | null;
  author_id: string | null;
  created_at: string;
  updated_at: string;
  authorName?: string | null;
  avatar?: string | null;
}

export interface CardChatMessagesResponse {
  data: CardChatMessage[];
  metadata: {
    cursor: string | null;
    hasMore: boolean;
  };
}

export async function startCardChatSession({
  api,
  cardId,
}: {
  api: { post: <T>(url: string, data?: unknown) => Promise<T> };
  cardId: string;
}): Promise<{ data: CardChatSession }> {
  return api.post<{ data: CardChatSession }>(`/cards/${cardId}/chat/session/start`, {});
}

export async function pauseCardChatSession({
  api,
  cardId,
  sessionId,
}: {
  api: { post: <T>(url: string, data?: unknown) => Promise<T> };
  cardId: string;
  sessionId: string;
}): Promise<{ data: CardChatSession }> {
  return api.post<{ data: CardChatSession }>(`/cards/${cardId}/chat/session/pause`, { sessionId });
}

export async function resumeCardChatSession({
  api,
  cardId,
  sessionId,
}: {
  api: { post: <T>(url: string, data?: unknown) => Promise<T> };
  cardId: string;
  sessionId: string;
}): Promise<{ data: CardChatSession }> {
  return api.post<{ data: CardChatSession }>(`/cards/${cardId}/chat/session/resume`, { sessionId });
}

export async function getCardChatMessages({
  api,
  cardId,
}: {
  api: { get: <T>(url: string) => Promise<T> };
  cardId: string;
}): Promise<CardChatMessagesResponse> {
  return api.get<CardChatMessagesResponse>(`/cards/${cardId}/chat/messages`);
}

export async function createCardChatMessage({
  api,
  cardId,
  sessionId,
  content,
  role,
}: {
  api: { post: <T>(url: string, data: unknown) => Promise<T> };
  cardId: string;
  sessionId: string;
  content: string;
  role?: 'user' | 'assistant' | 'system';
}): Promise<{ data: CardChatMessage }> {
  return api.post<{ data: CardChatMessage }>(`/cards/${cardId}/chat/messages`, {
    sessionId,
    content,
    ...(role ? { role } : {}),
  });
}

/**
 * Get the current card-chat session and latest message for a card.
 * Returns { data: { session, latestMessage } } if a session exists,
 * or { data: null } if no active session is found.
 */
export async function getCardChatSession({
  api,
  cardId,
}: {
  api: { get: <T>(url: string) => Promise<T> };
  cardId: string;
}): Promise<{
  data: { session: CardChatSession; latestMessage: CardChatMessage | null } | null;
}> {
  return api.get<{
    data: { session: CardChatSession; latestMessage: CardChatMessage | null } | null;
  }>(`/cards/${cardId}/chat`);
}

export interface RefineCardChatResult {
  assistantMessage: CardChatMessage;
  session: CardChatSession;
  qualityScore: {
    earsCoverage: number;
    acceptanceCriteria: number;
    constraintClarity: number;
    testability: number;
    ambiguityPenalty: number;
    total: number;
  };
  loopComplete: boolean;
}

/**
 * Trigger the BA persona refinement loop for an active card-chat session.
 * The server runs up to 8 turns of targeted questioning, scoring quality
 * after each turn, and returns the latest assistant message + updated session.
 */
export async function refineCardChat({
  api,
  cardId,
  sessionId,
}: {
  api: { post: <T>(url: string, data: unknown) => Promise<T> };
  cardId: string;
  sessionId: string;
}): Promise<{ data: RefineCardChatResult }> {
  return api.post<{ data: RefineCardChatResult }>(`/cards/${cardId}/chat/refine`, {
    sessionId,
  });
}
