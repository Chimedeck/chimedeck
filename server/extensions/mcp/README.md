# Horiflow MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that lets AI assistants — Claude, Cursor, and any other MCP-compatible client — take actions inside Horiflow on your behalf.

The server is a lightweight Bun subprocess (`server/extensions/mcp/index.ts`) that bridges MCP tool calls to Horiflow's REST API using your personal API token.

---

## Prerequisites

- [Bun](https://bun.sh/) ≥ 1.0 installed on the machine that will run the MCP server
- A running Horiflow instance (local or remote)
- Dependencies installed: `bun install` from the project root

---

## Generate an API Token

1. Open Horiflow in your browser and sign in.
2. Go to **User Settings → API Tokens**.
3. Click **Generate new token** and copy the value — it starts with `hf_`.

> Keep your token secret. Treat it like a password.

---

## Register in Claude Desktop

Edit `~/.claude/claude_desktop_config.json` (create it if it does not exist) and add the `horiflow` entry under `mcpServers`:

```json
{
  "mcpServers": {
    "horiflow": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/server/extensions/mcp/index.ts"],
      "env": {
        "HORIFLOW_TOKEN": "hf_your_token_here",
        "HORIFLOW_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

Replace `/absolute/path/to` with the actual path to this repository on your machine.
`HORIFLOW_API_URL` defaults to `http://localhost:3000` — change it if your Horiflow instance is hosted elsewhere.

Restart Claude Desktop to pick up the change. The `horiflow` tools will appear in Claude's tool list.

---

## Register in Cursor

Create or edit `.cursor/mcp.json` in your home directory (or at the project root for project-scoped config):

```json
{
  "mcpServers": {
    "horiflow": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/server/extensions/mcp/index.ts"],
      "env": {
        "HORIFLOW_TOKEN": "hf_your_token_here",
        "HORIFLOW_API_URL": "http://localhost:3000"
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
| `HORIFLOW_TOKEN` | ✅ Yes | — | API token generated in User Settings |
| `HORIFLOW_API_URL` | No | `http://localhost:3000` | Base URL of the Horiflow API |

The server exits immediately with a clear error message if `HORIFLOW_TOKEN` is not set.

---

## Run Manually (for testing)

```bash
HORIFLOW_TOKEN=hf_... bun run server/extensions/mcp/index.ts
```

The server listens on **stdin/stdout** (MCP stdio transport) and is not intended to be run as a standalone HTTP server.

---

## Available Tools

| Tool | Description | Endpoint |
|---|---|---|
| `move_card` | Move a card to a different list, optionally at a specific position | `PATCH /api/v1/cards/:cardId/move` |
| `write_comment` | Post a comment on a card | `POST /api/v1/cards/:cardId/comments` |
| `create_card` | Create a new card in a list | `POST /api/v1/lists/:listId/cards` |
| `edit_card_description` | Update the description of a card | `PATCH /api/v1/cards/:cardId/description` |
| `set_card_price` | Set or clear the price on a card | `PATCH /api/v1/cards/:cardId/money` |
| `invite_to_board` | Invite a user to a board by email (requires board admin) | `POST /api/v1/boards/:boardId/members` |

### Tool Parameters

#### `move_card`
| Parameter | Type | Required | Description |
|---|---|---|---|
| `cardId` | string | ✅ | ID of the card to move |
| `targetListId` | string | ✅ | ID of the destination list |
| `position` | number | No | Zero-based position within the target list |

#### `write_comment`
| Parameter | Type | Required | Description |
|---|---|---|---|
| `cardId` | string | ✅ | ID of the card to comment on |
| `text` | string | ✅ | Comment body text |

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
