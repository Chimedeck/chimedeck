# Sprint 107 — MCP Read Tools (Search Cards, Search Boards, Fetch Card Details)

> **Status:** Planned
> **Depends on:** Sprint 106 (Remote MCP / HTTP transport)

---

## Goal

Extend the MCP server with three read-only tools that give AI agents the ability to discover content in Horiflow without needing to know IDs up front:

| Tool | Purpose |
|------|---------|
| `search_cards` | Full-text search over cards within a workspace |
| `search_board` | Full-text search over cards and lists scoped to a single board |
| `get_card` | Fetch full detail for a single card by ID |

These tools reuse the existing REST API surface — no new database queries are introduced. The MCP layer simply wraps the already-tested endpoints with appropriate schemas and natural-language descriptions.

---

## Background

The six existing MCP tools (`move_card`, `write_comment`, `create_card`, `edit_description`, `set_price`, `invite_to_board`) are all **write** operations. Agents currently have no way to:

- Discover which cards exist within a workspace before acting on them.
- Narrow a search to a specific board.
- Read the full state of a known card (title, description, checklist, labels, members, etc.).

The underlying REST endpoints are already implemented and production-tested:

| Endpoint | Sprint | Handler |
|----------|--------|---------|
| `GET /api/v1/workspaces/:id/search?q=…` | search extension | `handleSearch` |
| `GET /api/v1/boards/:boardId/search?q=…` | search extension | `handleBoardSearch` |
| `GET /api/v1/cards/:id` | card extension | `handleGetCard` |

---

## Architecture

Three new tool files under `server/extensions/mcp/tools/`:

```
server/extensions/mcp/tools/
├── searchCards.ts      ← new
├── searchBoard.ts      ← new
├── getCard.ts          ← new
├── moveCard.ts
├── writeComment.ts
├── createCard.ts
├── editDescription.ts
├── setCardPrice.ts
└── inviteToBoard.ts
```

Each file follows the same pattern as existing tools:

1. Accept a destructured zod schema as input.
2. Call `apiCall` from `../apiClient` — this automatically threads the `token` and handles error shape.
3. Return `{ content: [{ type: 'text', text: JSON.stringify(result.data) }] }` on success or `{ content: […], isError: true }` on failure.

`registerMcpTools` in `registerTools.ts` is updated to call the three new `register*` functions.

---

## Tool Specifications

### `search_cards`

Wraps `GET /api/v1/workspaces/:workspaceId/search`.

**Input schema:**
```ts
{
  workspaceId: z.string().describe('ID of the workspace to search within'),
  q: z.string().describe('Full-text search query'),
  limit: z.number().optional().describe('Maximum number of results to return (default: 20)'),
}
```

**Behaviour:**
- Calls `GET /api/v1/workspaces/{workspaceId}/search?q={q}&limit={limit}`.
- On success, returns the `data` array serialised as JSON text.
- On error, propagates the `error.name` from the API.

---

### `search_board`

Wraps `GET /api/v1/boards/:boardId/search`.

**Input schema:**
```ts
{
  boardId: z.string().describe('ID of the board to search within'),
  q: z.string().describe('Full-text search query'),
  limit: z.number().optional().describe('Maximum number of results to return'),
}
```

**Behaviour:**
- Calls `GET /api/v1/boards/{boardId}/search?q={q}&limit={limit}`.
- On success, returns the `data` array serialised as JSON text.
- On error, propagates the API error name.

---

### `get_card`

Wraps `GET /api/v1/cards/:id`.

**Input schema:**
```ts
{
  cardId: z.string().describe('ID of the card to fetch'),
}
```

**Behaviour:**
- Calls `GET /api/v1/cards/{cardId}`.
- On success, returns the full card object (title, description, labels, members, checklists, due dates, etc.) serialised as JSON text.
- On error (`card-not-found`, auth errors), propagates the API error name.

---

## Files Affected

| File | Change |
|------|--------|
| `server/extensions/mcp/tools/searchCards.ts` | **New** — `registerSearchCards` |
| `server/extensions/mcp/tools/searchBoard.ts` | **New** — `registerSearchBoard` |
| `server/extensions/mcp/tools/getCard.ts` | **New** — `registerGetCard` |
| `server/extensions/mcp/registerTools.ts` | Import and call the three new `register*` functions |
| `server/extensions/mcp/README.md` | Document the three new tools (input/output, example calls) |

---

## Acceptance Criteria

- [ ] `search_cards` tool is registered and returns matching cards from the workspace search endpoint
- [ ] `search_board` tool is registered and returns matching cards/lists from the board search endpoint
- [ ] `get_card` tool is registered and returns full card detail from the card detail endpoint
- [ ] All three tools pass their bearer token to `apiCall` identically to existing tools
- [ ] Invalid/missing IDs return `isError: true` with the API error name in the text content
- [ ] `registerTools.ts` imports and registers all three new tools
- [ ] `server/extensions/mcp/README.md` updated with entries for the three new tools
- [ ] No direct database access in the MCP tool layer — all data fetched via `apiCall`
