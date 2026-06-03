# Sprint 166 - Conversation Storage: Raw + Vector

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 165 (Board Chat Access Control + Guest Overrides)
> **Status:** ⬜ Future

---

## Goal

Persist board chat conversations in two representations: raw message text for audit/history and vector embeddings for semantic retrieval/search.

---

## Strict Boundary

1. This sprint provides storage and retrieval primitives only.
2. LLM orchestration and function-calling are handled in Sprint 167.
3. UI editor changes are out of scope.

---

## Scope

### 1. Data Model

Add chat persistence tables:

- `board_chat_threads`
- `board_chat_messages` (raw content, author, timestamps)
- `board_chat_message_vectors` (message_id, embedding vector, model metadata)

All records are board-scoped and enforce board access checks.

### 2. Write Path

On message creation:

1. Save raw message text.
2. Generate embedding via embedding provider interface.
3. Save vector and model info.

If embedding fails, raw message remains stored and vector job is retried asynchronously.

### 3. Read/Search API

- `GET /api/v1/boards/:boardId/chat/messages` (history, paginated)
- `POST /api/v1/boards/:boardId/chat/search` (semantic search using vector similarity)

Search response returns matched messages and similarity score metadata.

### 4. Operations

- Indexing strategy for fast board-scoped history reads.
- Background retry queue for missing embeddings.
- Retention policy hook placeholder (no deletion policy enforced yet).

---

## Deliverables

1. DB migration(s) for chat raw + vector storage.
2. Message write service with embedding side path.
3. History and semantic search endpoints.
4. Retry mechanism for failed vector generation.
5. Integration tests for message insert and semantic retrieval.

---

## Acceptance Criteria

1. Every sent chat message is stored as raw text with board/user linkage.
2. Vector record is created for messages with successful embedding generation.
3. Failed embedding generation does not lose raw message data.
4. History endpoint returns ordered messages with pagination.
5. Semantic search returns board-scoped relevant messages with scores.
6. Guests can only read/search if allowed by Sprint 165 permissions.
