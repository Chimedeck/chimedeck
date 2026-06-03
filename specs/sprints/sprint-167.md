# Sprint 167 - OpenAI-Compatible Adapter + Card Function Calling

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 166 (Conversation Storage: Raw + Vector), Sprint 07 (Card Core)
> **Status:** ⬜ Future

---

## Goal

Add an LLM adapter that supports OpenAI-compatible APIs with configurable credentials and endpoint, then use function calling to allow AI to create board cards from chat context.

---

## Strict Boundary

1. Adapter and orchestration only for board chat use case.
2. Only `create card` function is required in this sprint.
3. Multi-provider routing UI is out of scope.

---

## Scope

### 1. OpenAI-Compatible Adapter

Create a provider adapter interface and first implementation for OpenAI-compatible APIs:

- Configurable `apiKey`, `baseUrl`, and `model`.
- Request format compatible with OpenAI chat/completions + tools.
- Response normalizer to internal shape.

All provider configuration is loaded from server config modules, not inline env reads.

### 2. Chat Assist Endpoint

Add endpoint:

- `POST /api/v1/boards/:boardId/chat/assist`

Inputs:
- Latest user prompt
- Retrieved chat history context (raw + semantic snippets)

Outputs:
- Assistant text response
- Optional tool/function result metadata

Sidebar UI alignment:
- Composer footer includes an `AI Assist` quick action.
- Assistant replies are rendered as distinct assistant card blocks in timeline.
- Function-call suggestion card can include contextual evidence summary and action CTA.

### 3. Function Calling: Create Card

Expose tool/function schema to the model, for example:

- `create_board_card(title, description, listId, dueDate, memberIds)`

Runtime behaviour:
1. Call LLM with tool schema.
2. Detect tool/function invocation in response.
3. Validate payload and board permissions.
4. Trigger existing card creation service.
5. Return created card details in assist response.

Interaction model in chat sidebar:
- Assistant can present a `Create card` primary action button when confidence and payload validation pass.
- Secondary dismissal action hides suggestion without creating card.
- On creation success, card preview should show title/source metadata and board linkage.

### 4. Safety + Audit

- Enforce board permissions before card creation.
- Add idempotency key on tool execution path.
- Record activity log entry for AI-created cards.
- Persist assistant action-card metadata with `suggested` / `confirmed` / `dismissed` states for the chat UI contract.

---

## Deliverables

1. Provider adapter interface + OpenAI-compatible implementation.
2. Config wiring for key/base URL/model overrides.
3. `chat/assist` endpoint with tool-calling support.
4. `create_board_card` tool executor connected to card service.
5. Integration tests for normal text responses and tool-triggered card creation.
6. UI contract documentation for AI assist card state: suggested, confirmed, dismissed.

---

## Acceptance Criteria

1. Adapter works with OpenAI endpoint and any compatible base URL.
2. API key and endpoint can be switched without code changes.
3. Assist endpoint returns normal assistant text when no tool call is requested.
4. When model returns create-card function call, server validates and creates a card.
5. Invalid function payload is rejected with typed `422` error.
6. AI-created card appears on board and activity log includes creation source.
7. Chat UI supports explicit user confirmation path via `Create card` action prior to execution when confirmation mode is enabled.
8. Assist responses expose action-card metadata suitable for the board chat drawer.
