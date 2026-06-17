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

export interface CreateCardChatMessageResponse {
  userMessage: CardChatMessage;
  assistantMessage?: CardChatMessage;
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
}): Promise<{ data: CreateCardChatMessageResponse }> {
  return api.post<{ data: CreateCardChatMessageResponse }>(`/cards/${cardId}/chat/messages`, {
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

export interface ProposeDescriptionResult {
  proposedDescription: string;
  sessionId: string;
}

/**
 * Ask the AI to synthesize the conversation history into a structured
 * card description proposal. Returns the proposed Markdown description
 * for user confirmation before applying.
 */
export async function proposeCardDescription({
  api,
  cardId,
  sessionId,
}: {
  api: { post: <T>(url: string, data: unknown) => Promise<T> };
  cardId: string;
  sessionId: string;
}): Promise<{ data: ProposeDescriptionResult }> {
  return api.post<{ data: ProposeDescriptionResult }>(`/cards/${cardId}/chat/propose-description`, {
    sessionId,
  });
}

/**
 * List all chat sessions for a card so the user can switch between
 * past conversations instead of always starting fresh.
 */
export async function listCardChatSessions({
  api,
  cardId,
}: {
  api: { get: <T>(url: string) => Promise<T> };
  cardId: string;
}): Promise<{ data: CardChatSession[] }> {
  return api.get<{ data: CardChatSession[] }>(`/cards/${cardId}/chat/sessions`);
}

export interface CardChatAssistActionCard {
  state: 'suggested' | 'confirmed' | 'dismissed';
  toolName: string;
  toolCallId: string;
  idempotencyKey: string;
  source: 'card-chat-assist';
  cardId: string;
  workspaceId: string;
  descriptionContent?: string;
  descriptionPreview?: string;
}

export interface CardChatAssistResponse {
  userMessage: CardChatMessage;
  message?: string;
  actionCards?: CardChatAssistActionCard[];
}

/**
 * Request AI assist for a card-chat session with tool-use capability.
 * The AI can call write_card_description to propose a description update,
 * which appears as an action card for user confirmation.
 */
export async function requestCardChatAssist({
  api,
  cardId,
  sessionId,
  prompt,
}: {
  api: { post: <T>(url: string, data: unknown) => Promise<T> };
  cardId: string;
  sessionId: string;
  prompt: string;
}): Promise<{ data: CardChatAssistResponse }> {
  return api.post<{ data: CardChatAssistResponse }>(`/cards/${cardId}/chat/assist`, {
    sessionId,
    prompt,
  });
}

export interface CardChatAssistCommitProposal {
  toolCallId: string;
  idempotencyKey: string;
  description: string;
}

/**
 * Commit a confirmed description proposal to the card.
 * Applies the AI-proposed description to the card.
 */
export async function commitCardChatProposal({
  api,
  cardId,
  proposal,
}: {
  api: { post: <T>(url: string, data: unknown) => Promise<T> };
  cardId: string;
  proposal: CardChatAssistCommitProposal;
}): Promise<{ data: { success: boolean } }> {
  return api.post<{ data: { success: boolean } }>(`/cards/${cardId}/chat/assist/commit-description`, proposal);
}
