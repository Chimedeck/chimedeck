# Sprint 109 — MCP Docs: Remote Connection Instructions

> **Status:** Done
> **Depends on:** Sprint 108 (MCP Docs Page)

---

## Goal

Fix the **Connecting** section of the MCP Docs page (`/developer/mcp`) so it correctly reflects
the **remote HTTP** transport model instead of local stdio subprocess configuration.

The docs are intended for end-users and operators who connect their AI tools (Claude Desktop,
Cursor, custom agents) to an already-running Taskinate server — not for developers running the
server binary locally.

---

## Background

Sprint 108 shipped the MCP Docs page with Claude Desktop and Cursor config snippets that used
`command`/`args` pointing to a local file path:

```json
{
  "mcpServers": {
    "taskinate": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/server/extensions/mcp/index.ts"],
      "env": { "TASKINATE_TOKEN": "...", "TASKINATE_API_URL": "..." }
    }
  }
}
```

This is the stdio transport for running the server as a local subprocess — only useful for
developers hosting their own instance from source. The target audience for this page is anyone
connecting to a **deployed** Taskinate instance over HTTP.

---

## Changes

### `src/extensions/DeveloperDocs/containers/McpDocsPage/McpDocsPage.tsx`

Rewrote the **Connecting** section:

- Replaced `command`/`args`/`env` stdio snippets with `type: "http"` remote URL + `headers`
  snippets for Claude Desktop and Cursor.
- Replaced the `Environment variables` table (which only applied to the stdio transport) with a
  short **"Other MCP clients"** paragraph covering any HTTP-capable MCP client.
- Added a short introductory paragraph clarifying that no local install is required — users
  simply point their client at the server URL.

#### Claude Desktop snippet (after)
```json
{
  "mcpServers": {
    "taskinate": {
      "type": "http",
      "url": "https://your-taskinate-instance.com/api/mcp",
      "headers": {
        "Authorization": "Bearer hf_your_token_here"
      }
    }
  }
}
```

#### Cursor snippet (after)
```json
{
  "mcpServers": {
    "taskinate": {
      "url": "https://your-taskinate-instance.com/api/mcp",
      "headers": {
        "Authorization": "Bearer hf_your_token_here"
      }
    }
  }
}
```

---

## Acceptance Criteria

- [ ] The Connecting section shows `url` + `headers` configs, not `command`/`args`.
- [ ] No mention of local file paths or environment variables in the Connecting section.
- [ ] Claude Desktop, Cursor, and a generic "Other MCP clients" paragraph are all present.
- [ ] The rest of the page (Authentication, Endpoint Reference, Tool Details) is unchanged.
