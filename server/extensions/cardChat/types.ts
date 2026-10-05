// Shared types for the card-chat feature (Sprint 171).

export type CardChatSessionStatus = 'IDLE' | 'ACTIVE_REFINEMENT' | 'PAUSED' | 'READY_FOR_REVIEW';

export type CardChatMessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface CardChatSession {
  id: string;
  card_id: string;
  workspace_id: string;
  created_by: string;
  status: CardChatSessionStatus;
  quality_score: number | null;
  last_actor_at: string;
  created_at: string;
  updated_at: string;
}

export interface CardChatMessage {
  id: string;
  session_id: string;
  role: CardChatMessageRole;
  content: string;
  metadata: string | null;
  author_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WriteCardChatMessageInput {
  sessionId: string;
  cardId: string;
  authorId: string;
  role: CardChatMessageRole;
  content: string;
}

export interface WriteCardChatMessageResult {
  status: 201;
  data: {
    message: CardChatMessage;
  };
}

export interface StartSessionInput {
  cardId: string;
  workspaceId: string;
  userId: string;
}

export interface PauseSessionInput {
  sessionId: string;
  cardId: string;
  userId: string;
}

export interface ResumeSessionInput {
  sessionId: string;
  cardId: string;
  userId: string;
}

export interface GetCardChatMessagesInput {
  cardId: string;
  cursor?: string | null;
  limit?: number;
}

export interface GetCardChatMessagesResult {
  data: Array<{
    id: string;
    session_id: string;
    role: CardChatMessageRole;
    content: string;
    metadata: string | null;
    author_id: string | null;
    created_at: string;
    updated_at: string;
    authorName?: string | null;
    avatar?: string | null;
  }>;
  metadata: {
    cursor: string | null;
    hasMore: boolean;
  };
}

export interface GetCardChatSessionResult {
  status: 200;
  data: {
    session: CardChatSession;
    latestMessage: CardChatMessage | null;
  } | null;
}

// ── Sprint 171 — BA Persona Refinement Loop ──

export type GoalQuestionCategory =
  | 'business_value'
  | 'ears_requirements'
  | 'acceptance_criteria'
  | 'constraints';

export interface QualityScoreBreakdown {
  earsCoverage: number; // 0-25
  acceptanceCriteria: number; // 0-25
  constraintClarity: number; // 0-25
  testability: number; // 0-25
  ambiguityPenalty: number; // 0-10
  total: number; // 0-100
}

export interface RefineCardChatInput {
  sessionId: string;
  cardId: string;
  workspaceId: string;
  userId: string;
}

export interface RefineCardChatResult {
  status: number;
  data?: {
    session: CardChatSession;
    assistantMessage: CardChatMessage;
    qualityScore: QualityScoreBreakdown;
    loopComplete: boolean;
  };
  name?: string;
  message?: string;
}

// [why] Activity event types for the card-chat refinement lifecycle,
// emitted via dispatchEvent so they appear in the card activity stream.
export type CardChatActivityType =
  | 'card_ai_assist_started'
  | 'card_ai_question_asked'
  | 'card_ai_quality_scored'
  | 'card_ai_assist_paused'
  | 'card_ai_assist_ready_for_review';

export interface CardChatActivityInput {
  type: CardChatActivityType;
  cardId: string;
  sessionId: string;
  actorId: string;
  payload?: Record<string, unknown>;
}

// ── Sprint 208 — AI Assist tool-use types ──

export interface CardChatAssistToolParameters {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface CardChatAssistToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: CardChatAssistToolParameters;
  };
}

export interface CardChatAssistToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// [why] OpenAI-compatible multimodal content parts. image_url uses data: URIs
// with base64-encoded image data so no external URL fetching is needed.
// text parts carry file contents for txt/csv/md attachments.
export type CardChatAssistContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } };

export interface CardChatAssistOutput {
  status: number;
  data?: {
    message?: string;
    model: string;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
    toolCalls?: CardChatAssistToolCall[];
    // [why] Multimodal content parts (images, text files) from card attachments.
    // Carried alongside the message so the tool-result message can include
    // base64-encoded images for vision-capable providers.
    contentParts?: CardChatAssistContentPart[];
  };
  name?: string;
  message?: string;
}

// ── AI Provider (reuses board-chat assist provider config) ──

export interface CardChatProviderMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  // [why] Nullable because assistant messages that contain only tool calls
  // may have null content from some providers (OpenAI, Ollama).
  // [why] ContentParts array enables multimodal messages (images, text files)
  // for vision-capable providers like Ollama and OpenAI-compatible APIs.
  content: string | null | CardChatAssistContentPart[];
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  toolCallId?: string;
}

export interface CardChatProviderInput {
  messages: CardChatProviderMessage[];
  tools?: CardChatAssistToolDefinition[];
}

export interface CardChatProviderOutput {
  status: number;
  data?: {
    model: string;
    message: string;
    toolCalls?: Array<{
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
    }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
  name?: string;
  message?: string;
}
