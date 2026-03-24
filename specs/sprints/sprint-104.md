# Sprint 104 — MCP Server

> **Status:** Planned
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 101 (API Token auth), Sprint 103 (External API surface)

---

## Goal

Expose a **Model Context Protocol (MCP) server** so AI assistants (Claude, Cursor, etc.) can take actions inside Horiflow on behalf of the user.

The MCP server is a separate lightweight Bun process (`server/extensions/mcp/index.ts`) that:
1. Accepts the user's Horiflow API token via the `HORIFLOW_TOKEN` environment variable (or `--token` CLI flag when run directly).
2. Implements the MCP `stdio` transport so it can be registered as a tool server in any compliant client.
3. Exposes 6 tools — each tool makes a single authenticated HTTP call to the Horiflow API.

The MCP server itself contains **no business logic** — it is purely an adapter layer between MCP tool calls and the existing REST API.

---

## Acceptance Criteria

- [ ] `server/extensions/mcp/index.ts` is a runnable Bun script (`#!/usr/bin/env bun`)
- [ ] Implements MCP stdio transport (JSON-RPC over stdin/stdout)
- [ ] Declares 6 tools: `move_card`, `write_comment`, `create_card`, `edit_card_description`, `set_card_price`, `invite_to_board`
- [ ] Each tool validates its input schema and returns a clear error if required params are missing
- [ ] Uses `HORIFLOW_TOKEN` env var (or `--token` flag) to attach `Authorization: Bearer <token>` on all API calls
- [ ] Uses `HORIFLOW_API_URL` env var (default `http://localhost:3000`) as the API base URL
- [ ] `invite_to_board` returns a structured error when the token holder lacks board admin permission
- [ ] `README.md` explains how to register the MCP server in Claude Desktop / Cursor

---

## Scope

### 1. MCP server entry point

**`server/extensions/mcp/index.ts`**

```ts
#!/usr/bin/env bun
/**
 * Horiflow MCP server — stdio transport.
 * Run: HORIFLOW_TOKEN=hf_... bun server/extensions/mcp/index.ts
 */
```

Use the `@modelcontextprotocol/sdk` package (MCP TypeScript SDK). Install with `bun add @modelcontextprotocol/sdk`.

Structure:
```ts
const server = new McpServer({ name: 'horiflow', version: '1.0.0' });

server.tool('move_card', schema, handler);
server.tool('write_comment', schema, handler);
// ...

const transport = new StdioServerTransport();
await server.connect(transport);
```

---

### 2. Config module

**`server/extensions/mcp/config.ts`**

```ts
export const config = {
  apiUrl: Bun.env.HORIFLOW_API_URL ?? 'http://localhost:3000',
  token:  Bun.env.HORIFLOW_TOKEN ?? '',
};
```

Throws a startup error if `token` is empty.

---

### 3. API client helper

**`server/extensions/mcp/apiClient.ts`**

```ts
// Thin fetch wrapper that attaches Authorization and handles error shapes.
export async function apiCall<T>({
  method,
  path,
  body,
}: {
  method: string;
  path: string;
  body?: unknown;
}): Promise<{ data: T } | { error: { name: string; data?: unknown } }>
```

---

### 4. Tool definitions

**`server/extensions/mcp/tools/`**

```
tools/
  moveCard.ts           # move_card
  writeComment.ts       # write_comment
  createCard.ts         # create_card
  editDescription.ts    # edit_card_description
  setCardPrice.ts       # set_card_price
  inviteToBoard.ts      # invite_to_board
```

#### Tool schemas (Zod or plain JSON Schema):

**`move_card`**
```ts
{ cardId: string; targetListId: string; position?: number }
```
→ `PATCH /api/v1/cards/:cardId/move`

**`write_comment`**
```ts
{ cardId: string; text: string }
```
→ `POST /api/v1/cards/:cardId/comments`

**`create_card`**
```ts
{ listId: string; title: string; description?: string }
```
→ `POST /api/v1/lists/:listId/cards`

**`edit_card_description`**
```ts
{ cardId: string; description: string }
```
→ `PATCH /api/v1/cards/:cardId/description`

**`set_card_price`**
```ts
{ cardId: string; amount: number | null; currency?: string; label?: string }
```
→ `PATCH /api/v1/cards/:cardId/money`

**`invite_to_board`**
```ts
{ boardId: string; email: string; role?: 'member' | 'observer' }
```
→ `POST /api/v1/boards/:boardId/members`

---

### 5. README

**`server/extensions/mcp/README.md`**

Cover:
1. Prerequisites: Bun installed, Horiflow running.
2. Generate an API token in User Settings → API Tokens.
3. Register in Claude Desktop (`~/.claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "horiflow": {
      "command": "bun",
      "args": ["run", "/path/to/server/extensions/mcp/index.ts"],
      "env": {
        "HORIFLOW_TOKEN": "hf_...",
        "HORIFLOW_API_URL": "http://localhost:3000"
      }
    }
  }
}
```
4. Register in Cursor (`.cursor/mcp.json` format).
5. Available tools overview.

---

## File Checklist

| File | Change |
|------|--------|
| `server/extensions/mcp/index.ts` | MCP server entry point |
| `server/extensions/mcp/config.ts` | Config module |
| `server/extensions/mcp/apiClient.ts` | Fetch wrapper |
| `server/extensions/mcp/tools/moveCard.ts` | `move_card` tool |
| `server/extensions/mcp/tools/writeComment.ts` | `write_comment` tool |
| `server/extensions/mcp/tools/createCard.ts` | `create_card` tool |
| `server/extensions/mcp/tools/editDescription.ts` | `edit_card_description` tool |
| `server/extensions/mcp/tools/setCardPrice.ts` | `set_card_price` tool |
| `server/extensions/mcp/tools/inviteToBoard.ts` | `invite_to_board` tool |
| `server/extensions/mcp/README.md` | Setup guide |
| `package.json` | Add `@modelcontextprotocol/sdk` dependency |

---

## Tests

| ID | Scenario | Expected |
|----|----------|---------|
| T1 | `move_card` tool called with valid cardId + targetListId | API request sent; success response returned to MCP client |
| T2 | `write_comment` tool called | Comment created; response contains comment id |
| T3 | `create_card` tool called | Card created in specified list |
| T4 | `edit_card_description` tool called | Card description updated |
| T5 | `set_card_price` tool with amount + currency | Money fields updated |
| T6 | `set_card_price` with amount=null | Money cleared |
| T7 | `invite_to_board` — token holder is admin | Member invited successfully |
| T8 | `invite_to_board` — token holder lacks permission | Structured error returned (not crash) |
| T9 | `HORIFLOW_TOKEN` not set | Server exits with clear error message at startup |
| T10 | Tool called with missing required param | Error returned; server does not crash |
