# MCP Tool Tests — Overview

These files test the Horiflow MCP server tools directly via the `/mcp` endpoint.

**Authentication:** All requests require a valid Bearer token obtained by:
```http
POST {TEST_CREDENTIALS.baseUrl}/api/v1/auth/login
{ "email": "{TEST_CREDENTIALS.admin.email}", "password": "{TEST_CREDENTIALS.admin.password}" }
```
Use `response.data.token` as `$token`.

**Unauthenticated baseline:** Every tool must return `401` when called without a token.

---

## Tool Flows (in logical order)

| File | Tool | Depends on |
|---|---|---|
| `mcp-01-get-boards.md` | `get_boards` | workspace exists |
| `mcp-02-get-board.md` | `get_board` | board exists |
| `mcp-03-get-members.md` | `get_members` | board + workspace members |
| `mcp-04-get-cards.md` | `get_cards` | list with cards |
| `mcp-05-get-card.md` | `get_card` | card exists |
| `mcp-06-create-card.md` | `create_card` | list exists |
| `mcp-07-move-card.md` | `move_card` | 2 lists + card |
| `mcp-08-search-cards.md` | `search_cards` | cards with content |
| `mcp-09-add-comment.md` | `add_comment` | card exists |

Run main flows 05–08 before running MCP flows — they provide the board, lists, and cards used here.
