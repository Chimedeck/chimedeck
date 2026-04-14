# ChimeDeck MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that lets AI assistants — Claude, Cursor, and any other MCP-compatible client — take actions inside ChimeDeck on your behalf.

The server is a lightweight Bun subprocess (`server/extensions/mcp/index.ts`) that bridges MCP tool calls to ChimeDeck's REST API using your personal API token.

---

## Prerequisites

- [Bun](https://bun.sh/) ≥ 1.0 installed on the machine that will run the MCP server
- A running ChimeDeck instance (local or remote)
- Dependencies installed: `bun install` from the project root

---

## Generate an API Token

1. Open ChimeDeck in your browser and sign in.
2. Go to **User Settings → API Tokens**.
3. Click **Generate new token** and copy the value — it starts with `hf_`.

> Keep your token secret. Treat it like a password.

---

## Register in Claude Desktop

Edit `~/.claude/claude_desktop_config.json` (create it if it does not exist) and add the `chimedeck` entry under `mcpServers`:

```json
{
  "mcpServers": {
    "chimedeck": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/server/extensions/mcp/index.ts"],
      "env": {
        "CHIMEDECK_TOKEN": "hf_your_token_here",
        "CHIMEDECK_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

Replace `/absolute/path/to` with the actual path to this repository on your machine.
`CHIMEDECK_API_URL` defaults to `http://localhost:3000` — change it if your ChimeDeck instance is hosted elsewhere.

Restart Claude Desktop to pick up the change. The `chimedeck` tools will appear in Claude's tool list.

---

## Register in Cursor

Create or edit `.cursor/mcp.json` in your home directory (or at the project root for project-scoped config):

```json
{
  "mcpServers": {
    "chimedeck": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/server/extensions/mcp/index.ts"],
      "env": {
        "CHIMEDECK_TOKEN": "hf_your_token_here",
        "CHIMEDECK_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

Reload Cursor after saving the file.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `CHIMEDECK_TOKEN` | ✅ Yes | — | API token generated in User Settings |
| `CHIMEDECK_API_URL` | No | `http://localhost:3000` | Base URL of the ChimeDeck API |

The server exits immediately with a clear error message if `CHIMEDECK_TOKEN` is not set.

---

## Run Manually (for testing)

```bash
CHIMEDECK_TOKEN=hf_... bun run server/extensions/mcp/index.ts
```

The server listens on **stdin/stdout** (MCP stdio transport) and is not intended to be run as a standalone HTTP server.

---

## Remote HTTP Transport

In addition to the local stdio subprocess, ChimeDeck exposes a persistent HTTP endpoint for MCP clients that cannot run a local subprocess (e.g., remote agents, CI environments, or web-based AI assistants).

### Endpoint

```
/api/mcp
```

Served on the **same port as the main ChimeDeck server** (default `3000`). No additional ports or environment variables are required.

### Authentication

Every request must include a valid `hf_` API token in the `Authorization` header:

```
Authorization: Bearer hf_your_token_here
```

Requests without a valid token are rejected with `401 Unauthorized` before any MCP logic runs.

### Session Lifecycle

1. **Initialize** — `POST /api/mcp` (no `mcp-session-id` header) creates a new isolated session and returns an `mcp-session-id` in the response headers.
2. **Interact** — subsequent `POST` requests (tool calls / notifications) or `GET` requests (SSE stream) must include the `mcp-session-id` header returned in step 1.
3. **Terminate** — `DELETE /api/mcp` with the session ID tears down the session immediately.

Sessions expire automatically after **30 minutes of inactivity**.

### curl Examples

#### 1. Initialize a session

```bash
curl -i -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer hf_your_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": {},
      "clientInfo": { "name": "my-agent", "version": "1.0.0" }
    }
  }'
```

The response headers will contain:

```
mcp-session-id: <uuid>
```

Copy this value for subsequent requests.

#### 2. Call a tool

```bash
SESSION_ID="<uuid-from-step-1>"

curl -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer hf_your_token_here" \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "write_comment",
      "arguments": { "cardId": "123", "text": "Done!" }
    }
  }'
```

#### 3. Open an SSE stream (server-sent events)

```bash
curl -N -X GET http://localhost:3000/api/mcp \
  -H "Authorization: Bearer hf_your_token_here" \
  -H "mcp-session-id: $SESSION_ID"
```

The connection stays open and the server pushes events as they occur.

#### 4. Terminate a session

```bash
curl -X DELETE http://localhost:3000/api/mcp \
  -H "Authorization: Bearer hf_your_token_here" \
  -H "mcp-session-id: $SESSION_ID"
```

Returns `204 No Content` on success.

### Error Responses

| Status | `name` | Meaning |
|---|---|---|
| `400` | `bad-request` | `mcp-session-id` header missing on a non-initialize request |
| `401` | `unauthorized` | Token absent or invalid |
| `403` | `forbidden` | Token belongs to a different user than the session owner |
| `404` | `session-not-found` | Session expired or never existed — re-initialize |

### stdio vs HTTP Transport Comparison

| Feature | stdio | Remote HTTP |
|---|---|---|
| **Transport** | stdin/stdout subprocess | HTTP/SSE (`/api/mcp`) |
| **Session scope** | One session per process | Many isolated sessions per server |
| **Authentication** | `CHIMEDECK_TOKEN` env var | `Authorization: Bearer hf_…` header |
| **Requires local install** | ✅ Yes (Bun + repo) | ❌ No — any HTTP client works |
| **Streaming (SSE)** | Via stdio protocol | Via `GET /api/mcp` SSE stream |
| **Session TTL** | Process lifetime | 30 min idle; explicit `DELETE` |
| **Multi-user** | One user per process | Each session is user-isolated |
| **Best for** | Claude Desktop, Cursor | Remote agents, CI, web UIs |

---

## Available Tools

| Tool | Description | Endpoint |
|---|---|---|
| `move_card` | Move a card to a different list, optionally after a specific card | `PATCH /api/v1/cards/:cardId/move` |
| `write_comment` | Post a comment on a card | `POST /api/v1/cards/:cardId/comments` |
| `create_card` | Create a new card in a list | `POST /api/v1/lists/:listId/cards` |
| `edit_card_description` | Update the description of a card | `PATCH /api/v1/cards/:cardId/description` |
| `set_card_price` | Set or clear the price on a card | `PATCH /api/v1/cards/:cardId/money` |
| `invite_to_board` | Invite a user to a board by email (requires board admin) | `POST /api/v1/boards/:boardId/members` |
| `search_cards` | Full-text search over cards within a workspace | `GET /api/v1/workspaces/:workspaceId/search` |
| `search_board` | Full-text search over cards and lists scoped to a single board | `GET /api/v1/boards/:boardId/search` |
| `get_card` | Retrieve the full details of a single card by its ID | `GET /api/v1/cards/:cardId` |

### Tool Parameters

#### `move_card`
| Parameter | Type | Required | Description |
|---|---|---|---|
| `cardId` | string | ✅ | ID of the card to move |
| `targetListId` | string | ✅ | ID of the destination list |
| `afterCardId` | string \| null | No | Insert after this card ID (`null` places at the top) |
| `position` | number | No | Deprecated alias. Only `0` is supported and maps to top |

#### `write_comment`
| Parameter | Type | Required | Description |
|---|---|---|---|
| `cardId` | string | ✅ | ID of the card to comment on |
| `content` | string | ✅ | Comment body text |
| `text` | string | No | Deprecated alias for `content` |

#### `create_card`
| Parameter | Type | Required | Description |
|---|---|---|---|
| `listId` | string | ✅ | ID of the list to create the card in |
| `title` | string | ✅ | Title of the new card |
| `description` | string | No | Optional card description |

#### `edit_card_description`
| Parameter | Type | Required | Description |
|---|---|---|---|
| `cardId` | string | ✅ | ID of the card to update |
| `description` | string | ✅ | New description text |

#### `set_card_price`
| Parameter | Type | Required | Description |
|---|---|---|---|
| `cardId` | string | ✅ | ID of the card |
| `amount` | number \| null | ✅ | Price amount, or `null` to clear the price |
| `currency` | string | No | ISO 4217 currency code (e.g. `USD`) |
| `label` | string | No | Display label for the price |

#### `invite_to_board`
| Parameter | Type | Required | Description |
|---|---|---|---|
| `boardId` | string | ✅ | ID of the board |
| `email` | string | ✅ | Email address of the user to invite |
| `role` | `"member"` \| `"observer"` | No | Role to assign (defaults to `"member"`) |

> **Note:** `invite_to_board` requires the token holder to be a board admin. If they are not, the tool returns a structured error (`current-user-is-not-admin`) instead of crashing.

#### `search_cards`
| Parameter | Type | Required | Description |
|---|---|---|---|
| `workspaceId` | string | ✅ | ID of the workspace to search within |
| `query` | string | ✅ | Full-text search query |
| `q` | string | No | Deprecated alias for `query` |
| `limit` | number | No | Maximum number of results to return (default: 20) |

#### `search_board`
| Parameter | Type | Required | Description |
|---|---|---|---|
| `boardId` | string | ✅ | ID of the board to search within |
| `query` | string | ✅ | Full-text search query |
| `q` | string | No | Deprecated alias for `query` |
| `limit` | number | No | Maximum number of results to return |

#### `get_card`
| Parameter | Type | Required | Description |
|---|---|---|---|
| `cardId` | string | ✅ | ID of the card to retrieve |
