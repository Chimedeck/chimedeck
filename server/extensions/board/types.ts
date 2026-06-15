// Shared types for the board feature.

export type MonetizationType = 'pre-paid' | 'pay-to-paid';
export type BoardVisibility = 'PUBLIC' | 'PRIVATE' | 'WORKSPACE';

// Sub-type of the workspace GUEST role, scoped to a specific board.
// VIEWER = read-only (original GUEST behaviour).
// MEMBER = full write/participate access within the board only.
export type GuestType = 'VIEWER' | 'MEMBER';

export interface BoardGuestAccess {
  id: string;
  user_id: string;
  board_id: string;
  guest_type: GuestType;
  granted_at: string;
  granted_by: string;
}

export interface Board {
  id: string;
  workspace_id: string;
  title: string;
  state: 'ACTIVE' | 'ARCHIVED';
  monetization_type: MonetizationType | null;
  github_project_url: string | null;
  visibility: BoardVisibility;
  description: string | null;
  background: string | null;
  created_at: string;
}

export interface BoardStar {
  user_id: string;
  board_id: string;
  created_at: string;
}

export interface BoardFollower {
  user_id: string;
  board_id: string;
  created_at: string;
}

export interface BoardWithIsStarred extends Board {
  isStarred: boolean;
}

// Chat permissions scoped to a board.
// org_member_can_view and org_member_can_use are always true and not stored in DB.
export interface BoardChatPermissions {
  board_id: string;
  guest_can_view: boolean;
  guest_can_use: boolean;
  updated_at: string;
}

export interface PatchBoardChatPermissionsBody {
  guest_can_view?: boolean;
  guest_can_use?: boolean;
}

export interface BoardChatThread {
  id: string;
  board_id: string;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
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
}

export interface BoardChatMessageVector {
  id: string;
  message_id: string;
  board_id: string;
  provider: string;
  model: string;
  dimensions: number;
  embedding: number[];
  created_at: string;
  updated_at: string;
}

export interface BoardChatEmbedding {
  provider: string;
  model: string;
  dimensions: number;
  values: number[];
}

export interface WriteBoardChatMessageInput {
  boardId: string;
  authorId?: string | null;
  content: string;
  isAssistant?: boolean;
}

export interface WriteBoardChatMessageResult {
  status: 201;
  data: {
    thread: BoardChatThread;
    message: BoardChatMessage;
    vector: BoardChatMessageVector | null;
    queuedForEmbeddingRetry: boolean;
  };
}

export interface BoardChatSearchHit {
  id: string;
  thread_id: string;
  board_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  userName: string | null;
  avatar: string | null;
  score: number;
}

export interface SearchBoardChatMessagesInput {
  boardId: string;
  query: string;
  limit?: number;
}

export interface SearchBoardChatMessagesOutput {
  status: number;
  data?: BoardChatSearchHit[];
  name?: string;
  message?: string;
}

export type BoardChatAssistRole = 'system' | 'user' | 'assistant' | 'tool';

export interface BoardChatAssistToolParameters {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface BoardChatAssistToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: BoardChatAssistToolParameters;
  };
}

export interface BoardChatAssistToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
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
  // [why] Document proposal fields — populated when the AI proposes GitHub documents.
  // content is only present for suggested proposals; once committed it is dropped
  // from the payload to keep websocket messages small.
  documentPath?: string;
  documentContent?: string;
  commitMessage?: string;
}

export interface BoardChatAssistMessage {
  role: BoardChatAssistRole;
  // [why] Nullable because assistant messages that contain only tool calls
  // may have null content from some providers (OpenAI, Ollama).
  content: string | null;
  toolCallId?: string;
  name?: string;
  // [why] Carried on assistant messages so the loop can feed tool calls
  // back as tool-result messages on the next turn.
  toolCalls?: BoardChatAssistToolCall[];
}

export interface BoardChatAssistInput {
  boardId: string;
  prompt: string;
  contextLimit?: number;
}

export interface BoardChatAssistOutput {
  status: number;
  data?: {
    message?: string;
    model: string;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
    toolCalls?: BoardChatAssistToolCall[];
    actionCard?: BoardChatAssistActionCard;
    // [why] Multi-proposal support: when the AI proposes several documents
    // in one turn, each gets its own action card returned here.
    actionCards?: BoardChatAssistActionCard[];
  };
  name?: string;
  message?: string;
}

// [why] Document commit request — client sends back confirmed proposals
// to persist to GitHub. Each proposal carries the same idempotency key
// that the server originally generated so duplicate commits are safe.
export interface BoardChatAssistCommitProposal {
  toolCallId: string;
  idempotencyKey: string;
  path: string;
  content: string;
  commitMessage: string;
}

export interface BoardChatAssistCommitInput {
  boardId: string;
  actorId: string;
  proposals: BoardChatAssistCommitProposal[];
}

export interface BoardChatAssistCommitOutput {
  status: number;
  data?: {
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
  };
  name?: string;
  message?: string;
}
