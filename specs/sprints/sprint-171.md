# Sprint 171 - Inner Card Chat + AI Assist Refinement Loop

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 164 (Board Chat UI Entry + Sidebar History), Sprint 166 (Conversation Storage: Raw + Vector), Sprint 167 (OpenAI-Compatible Adapter + Card Function Calling), Sprint 07 (Card Core)
> **Status:** ⬜ Future

---

## Goal

Introduce an Inner Card Chat that is explicitly activated from a card via an AI Assist button and runs a Business Analyst refinement loop until requirement quality reaches 90+ or the card is closed.

---

## Strict Boundary

1. This sprint adds card-scoped chat UX, prompt context, and quality loop mechanics.
2. Global chat remains unchanged except for handoff links into card-level chat.
3. No automatic repository writes are executed in this sprint.

---

## Scope

### 1. Card-Scoped Chat Session Model

Add card-scoped conversation records and retrieval APIs:

- `card_chat_sessions` table (card_id, workspace_id, created_by, status, quality_score, last_actor_at)
- `card_chat_messages` table (session_id, role, content, metadata)
- `GET /api/v1/cards/:cardId/chat`
- `POST /api/v1/cards/:cardId/chat/messages`
- `POST /api/v1/cards/:cardId/chat/session/start`
- `POST /api/v1/cards/:cardId/chat/session/pause`

Session states:
- `IDLE`
- `ACTIVE_REFINEMENT`
- `PAUSED`
- `READY_FOR_REVIEW`

### 2. Card Modal AI Assist UX

In card modal and card page contexts:

- Add `AI Assist` button in card actions panel
- Open inner chat drawer/panel scoped to selected card
- Show refinement status badge (`DRAFT`, `REFINING`, `READY`)
- Show visible quality score meter (`0-100`)
- Add explicit `Pause` control and auto-pause on card close

### 3. BA Persona + `/goal` Loop Engine

Implement loop orchestration for requirement refinement:

- BA persona prompt template with card context + board context + latest requirement snapshot
- `/goal` loop question categories:
  - Business value and expected outcomes
  - EARS-style requirement statements
  - Acceptance criteria and negative paths
  - Constraints, assumptions, non-goals
- Structured extraction into card fields and metadata:
  - `problem_statement`
  - `business_value`
  - `requirement_statements`
  - `acceptance_criteria`
  - `non_goals`

### 4. Quality Scoring and Stop Conditions

Quality scoring service produces deterministic score from completeness signals:

- EARS coverage
- Acceptance criteria quality
- Constraint clarity
- Testability
- Ambiguity penalty

Loop behavior:
- Continue asking targeted follow-ups while score `< 90`
- Transition to `READY_FOR_REVIEW` when score `>= 90`
- Pause loop immediately when card modal closes or user presses pause

### 5. Activity + Observability

Add events:

- `card_ai_assist_started`
- `card_ai_question_asked`
- `card_ai_quality_scored`
- `card_ai_assist_paused`
- `card_ai_assist_ready_for_review`

Add metrics:
- refinement loop turns per card
- average time-to-90
- pause/resume ratio

---

## Deliverables

1. Card-scoped chat persistence and APIs.
2. AI Assist button and inner chat UI inside card context.
3. BA persona `/goal` loop with targeted questioning.
4. Deterministic quality scoring with 90+ stop condition.
5. Activity and metrics coverage for loop lifecycle.

---

## Acceptance Criteria

1. User can open a card and start Inner Chat only via explicit `AI Assist` action.
2. Inner Chat remains scoped to that card and does not mix messages across cards.
3. Loop asks targeted requirement questions and updates card requirement fields continuously.
4. Quality score updates after each answer and reaches `READY_FOR_REVIEW` at `>= 90`.
5. Closing card pauses the loop and persists resumable state.
6. Audit events are visible in activity stream for loop lifecycle.
