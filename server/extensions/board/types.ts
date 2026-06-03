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
  author_id: string;
  content: string;
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
  authorId: string;
  content: string;
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
}

export interface BoardChatAssistMessage {
  role: BoardChatAssistRole;
  content: string;
  toolCallId?: string;
  name?: string;
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
  };
  name?: string;
  message?: string;
}

export interface BoardChatAssistProviderInput {
  messages: BoardChatAssistMessage[];
  tools?: BoardChatAssistToolDefinition[];
}

export interface BoardChatAssistProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

// Specs manifest types — Sprint 169
export interface SpecsManifestEntry {
  path: string;
  sizeBytes: number;
}

export interface SpecsManifest {
  ref: string;
  fetchedAt: string;
  files: SpecsManifestEntry[];
  etag: string;
}

export interface SpecsManifestCacheEntry {
  manifest: SpecsManifest;
  repoPath: string;
  cachedAtMs: number;
}

export interface SpecsFileResult {
  content: string;
  etag: string;
  sizeBytes: number;
}

export interface PutSpecsFileBody {
  path: string;
  content: string;
}

export interface PutSpecsFileResult {
  status: number;
  data: {
    path: string;
    content: string;
    etag: string;
    sha: string;
    created: boolean;
  };
}

export interface CommitSpecsBody {
  message: string;
  changedFiles: string[];
}

export interface CommitSpecsResult {
  status: number;
  data: {
    commitHash: string;
    pushStatus: 'pushed' | 'pending';
    branch: string;
    changedFiles: string[];
    footer: {
      actorId: string;
      boardId: string;
      botAlias: string;
    };
  };
}
