# Sprint 106 — Remote MCP (HTTP Transport)

> **Status:** Planned
> **Depends on:** Sprint 101 (API Token auth), Sprint 103 (External API surface), Sprint 105 (CLI, which introduced the MCP stdio server)

---

## Goal

Make the Horiflow MCP server accessible over HTTP so that any MCP-compatible AI client (Claude.ai, OpenAI, Cursor, custom agents, etc.) can connect to it via a URL — without needing local Bun access, without touching config files, and without spawning a separate process.

The MCP server is promoted from a local-only stdio subprocess to a persistent HTTP endpoint served alongside the existing Horiflow REST API. Authentication uses the same `hf_` API token system already in place.

**Remote clients connect with two pieces of information only:**
1. The MCP endpoint URL: `https://<host>/api/mcp`
2. An API token: `hf_...` (passed as `Authorization: Bearer hf_...`)

---

## Background

The current MCP integration (`server/extensions/mcp/index.ts`) uses `StdioServerTransport` — the client must spawn it as a local subprocess. This limits usage to developers with direct machine access.

The [MCP Streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http) (MCP spec 2025-03-26) exposes MCP over a single HTTP endpoint with optional SSE streaming. It is the canonical way to host MCP publicly.

---

## Architecture

```
Client (AI agent / Claude.ai / Cursor remote)
  │
  │  POST /api/mcp          ← initialize / tool calls / notifications
  │  GET  /api/mcp          ← open SSE stream (server-to-client events)
  │  DELETE /api/mcp        ← terminate session
  │
  ▼
server/index.ts  ──►  mcpHttpHandler(req)
                          │
                          ├─ authenticate(req)          ← reuse existing hf_ token auth
                          ├─ resolve / create session   ← sessions.ts (in-memory Map)
                          ├─ StreamableHTTPServerTransport
                          └─ McpServer (per session)    ← registerMcpTools()
```

Each session is independent: one `McpServer` + one `StreamableHTTPServerTransport` per connected client. Sessions are keyed by the `mcp-session-id` response header returned on the first `POST` (initialize).

---

## Acceptance Criteria

- [ ] `POST /api/mcp` initializes a session and returns `mcp-session-id` header
- [ ] `GET /api/mcp` opens an SSE stream for the session identified by `mcp-session-id`
- [ ] `DELETE /api/mcp` terminates the session
- [ ] All three endpoints require `Authorization: Bearer hf_...`; missing/invalid token → `401`
- [ ] Unauthenticated requests are rejected before any MCP logic runs
- [ ] All 6 tools (move-card, write-comment, create-card, edit-description, set-price, invite-to-board) work over HTTP identically to stdio
- [ ] Stale sessions (no activity for 30 min) are evicted automatically
- [ ] The endpoint is wired into `server/index.ts` under the path prefix `/api/mcp`
- [ ] `server/extensions/mcp/README.md` documents the HTTP endpoint, auth, and example `curl` calls
- [ ] No dedicated port: MCP runs on the same port as the main server

---

## Scope

### 1. Extract shared tool registration

**`server/extensions/mcp/registerTools.ts`** — new file

The stdio `index.ts` and the HTTP handler both need the same 6 tools registered. Extract into a shared helper so there is no duplication.

```ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerMoveCard } from './tools/moveCard';
import { registerWriteComment } from './tools/writeComment';
import { registerCreateCard } from './tools/createCard';
import { registerEditDescription } from './tools/editDescription';
import { registerSetCardPrice } from './tools/setCardPrice';
import { registerInviteToBoard } from './tools/inviteToBoard';

export function registerMcpTools(server: McpServer): void {
  registerMoveCard(server);
  registerWriteComment(server);
  registerCreateCard(server);
  registerEditDescription(server);
  registerSetCardPrice(server);
  registerInviteToBoard(server);
}
```

Update `server/extensions/mcp/index.ts` (stdio) to import and call `registerMcpTools` instead of registering tools inline.

---

### 2. Session store

**`server/extensions/mcp/http/sessions.ts`**

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

export interface McpSession {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  userId: string;
  lastActiveAt: Date;
}

// In-memory session store.  Key = mcp-session-id (UUID).
export const sessions = new Map<string, McpSession>();

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Evict stale sessions every 5 minutes.
setInterval(() => {
  const cutoff = new Date(Date.now() - SESSION_TTL_MS);
  for (const [id, session] of sessions) {
    if (session.lastActiveAt < cutoff) {
      session.transport.close().catch(() => {});
      sessions.delete(id);
    }
  }
}, 5 * 60 * 1000);
```

---

### 3. HTTP handler

**`server/extensions/mcp/http/index.ts`**

Handles all three HTTP verbs for `/api/mcp`.

```ts
import { randomUUID } from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { registerMcpTools } from '../registerTools';
import { sessions } from './sessions';

export async function mcpHttpHandler(req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  if (!url.pathname.startsWith('/api/mcp')) return null;

  // Auth first — deny before any MCP logic.
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const userId = (req as AuthenticatedRequest).currentUser!.id;
  const method = req.method.toUpperCase();

  // --- Initialize (POST, no session yet) ---
  if (method === 'POST' && !req.headers.get('mcp-session-id')) {
    const sessionId = randomUUID();
    const server = new McpServer({ name: 'horiflow', version: '1.0.0' });
    registerMcpTools(server);

    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => sessionId });
    sessions.set(sessionId, { server, transport, userId, lastActiveAt: new Date() });

    transport.onclose = () => sessions.delete(sessionId);
    await server.connect(transport);

    return transport.handleRequest(req);
  }

  // --- Subsequent requests — resolve session ---
  const sessionId = req.headers.get('mcp-session-id');
  if (!sessionId) {
    return Response.json({ name: 'bad-request', data: { message: 'mcp-session-id header required' } }, { status: 400 });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return Response.json({ name: 'session-not-found', data: { message: 'Session expired or unknown. Re-initialize.' } }, { status: 404 });
  }

  // Prevent session hijacking — token owner must match session owner.
  if (session.userId !== userId) {
    return Response.json({ name: 'forbidden' }, { status: 403 });
  }

  session.lastActiveAt = new Date();

  if (method === 'DELETE') {
    await session.transport.close();
    sessions.delete(sessionId);
    return new Response(null, { status: 204 });
  }

  // POST (tool call / notification) or GET (SSE stream)
  return session.transport.handleRequest(req);
}
```

---

### 4. Wire into main server

In **`server/index.ts`**, import and add the MCP handler early in the request pipeline (before the `404` fallback):

```ts
import { mcpHttpHandler } from './extensions/mcp/http/index';

// Inside the fetch handler, before the final 404:
const mcpRes = await mcpHttpHandler(req);
if (mcpRes) return mcpRes;
```

The handler returns `null` for any path that does not start with `/api/mcp`, so it is safe to place alongside other routers.

---

### 5. Update README

**`server/extensions/mcp/README.md`** — add a new "Remote HTTP" section covering:

- The endpoint URL pattern
- How to pass the `Authorization: Bearer hf_...` header
- Example `curl` commands for initialize, tool call, and SSE stream
- A note that the same token used for the REST API works here too
- Comparison table: stdio vs HTTP (when to use each)

---

## Environment Variables

No new env vars are required. The endpoint is always active when the main server runs.

If the team wants a kill-switch in the future, `MCP_HTTP_ENABLED=false` can be added to `server/config/env.ts` — but that is out of scope for this sprint.

---

## Security Notes

- Auth is enforced at the very first line of `mcpHttpHandler` — no MCP logic runs before identity is confirmed.
- Session ownership is verified on every subsequent request (prevents session ID guessing / hijacking).
- Sessions are evicted after 30 minutes of inactivity to limit resource leakage.
- The endpoint reuses the existing `hf_` token system — no new auth surface introduced.
- CORS: the existing CORS/security headers applied by `applySecurityHeaders` cover `/api/mcp` automatically since MCP is wired into the same Bun server.

---

## Out of Scope

- OAuth / dynamic client registration (MCP spec optional feature)
- Per-user tool scoping / permission levels (e.g. read-only tokens)
- Persistent session storage (Redis, DB) — in-memory is sufficient for V1
- Metrics / tracing for MCP sessions (can be added alongside OTel in a later sprint)
