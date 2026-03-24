# Sprint 103 — External API Surface Audit & Card Money Endpoint

> **Status:** Planned
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 101 (API Token auth), all card/board CRUD sprints

---

## Goal

Before the MCP server (Sprint 104) and CLI (Sprint 105) can be built, every operation they will expose must be reachable through a stable, documented REST endpoint that works with API token authentication.

This sprint audits the 6 target operations, fills any gaps (the card money/price endpoint is missing a dedicated PATCH), and produces a concise API reference document that both the MCP and CLI implementations can use as their contract.

**The 6 operations:**

| # | Operation | Existing endpoint |
|---|-----------|-------------------|
| 1 | Move card to another list | `PATCH /api/v1/cards/:id/move` ✅ |
| 2 | Write a comment on a card | Needs verification / creation |
| 3 | Create a card in a list | `POST /api/v1/lists/:listId/cards` ✅ |
| 4 | Edit card description | `PATCH /api/v1/cards/:id/description` ✅ |
| 5 | Set card price / money fields | No dedicated endpoint — add `PATCH /api/v1/cards/:id/money` |
| 6 | Invite a user to a board | `POST /api/v1/boards/:boardId/members` ✅ (permission-guarded) |

---

## Acceptance Criteria

- [ ] All 6 operations are callable with an API token (not just session JWT)
- [ ] `PATCH /api/v1/cards/:id/money` endpoint exists and updates `amount`, `currency`, `label` fields from `0019_card_money` migration
- [ ] Card comment endpoint (`POST /api/v1/cards/:id/comments`) exists and creates a comment
- [ ] All 6 endpoints return responses conforming to the standard `{ data: ... }` shape
- [ ] `docs/api-reference.md` documents all 6 endpoints (method, path, auth, body, response)
- [ ] Invite endpoint returns `403` with `{ name: 'insufficient-board-permissions' }` when caller lacks admin/owner role on the board

---

## Scope

### 1. Audit existing endpoints

Read and verify each of the 5 existing endpoints works correctly with `Authorization: Bearer hf_...` (Sprint 101 middleware). Fix any bugs found.

---

### 2. Card Money endpoint

**`server/extensions/card/api/money.ts`** (new)

```ts
// PATCH /api/v1/cards/:cardId/money
// Updates the card's money/price fields.
interface CardMoneyBody {
  amount?: number | null;
  currency?: string | null;   // ISO 4217, e.g. 'USD'
  label?: string | null;      // display label, e.g. 'Price', 'Budget'
}
```

Response: `{ data: { id, amount, currency, label } }`

Mount in **`server/extensions/card/api/index.ts`**:
```
PATCH /api/v1/cards/:id/money → handlePatchCardMoney
```

---

### 3. Card Comments endpoint

Check `server/extensions/board/api/comments.ts` — if it only handles board-level comments, add:

**`server/extensions/card/api/comments.ts`** (new if absent)

```
POST /api/v1/cards/:cardId/comments
```

Body: `{ text: string }`
Response: `{ data: { id, cardId, userId, text, createdAt } }`

Mount in `server/extensions/card/api/index.ts`.

---

### 4. API Reference doc

**`docs/api-reference.md`** (new)

Document all 6 endpoints in a consistent format:

```markdown
## Move card
PATCH /api/v1/cards/:id/move
Auth: Bearer token (JWT or API token)
Body: { listId: string; position?: number }
Response: { data: Card }

## Write comment
POST /api/v1/cards/:id/comments
...
```

Include authentication instructions: how to pass the `Authorization: Bearer hf_...` header.

---

## File Checklist

| File | Change |
|------|--------|
| `server/extensions/card/api/money.ts` | New PATCH card money endpoint |
| `server/extensions/card/api/comments.ts` | New (or verify existing) POST card comment |
| `server/extensions/card/api/index.ts` | Mount money + comments routes |
| `server/extensions/board/api/members/add.ts` | Verify permission guard returns correct error shape |
| `docs/api-reference.md` | New API reference for all 6 operations |

---

## Tests

| ID | Scenario | Expected |
|----|----------|---------|
| T1 | PATCH /api/v1/cards/:id/move with API token | Card moved; activity event fired |
| T2 | POST /api/v1/cards/:id/comments with API token | Comment created; returns `{ data: { id, text } }` |
| T3 | POST /api/v1/lists/:listId/cards with API token | Card created in correct list |
| T4 | PATCH /api/v1/cards/:id/description with API token | Description updated |
| T5 | PATCH /api/v1/cards/:id/money — set amount + currency | Returns updated money fields |
| T6 | PATCH /api/v1/cards/:id/money — clear amount (null) | Amount cleared in DB |
| T7 | POST /api/v1/boards/:boardId/members — caller is admin | Member added; returns 201 |
| T8 | POST /api/v1/boards/:boardId/members — caller is not admin | Returns 403 `insufficient-board-permissions` |
