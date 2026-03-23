import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

export interface McpSession {
  server: McpServer;
  transport: WebStandardStreamableHTTPServerTransport;
  userId: string;
  lastActiveAt: Date;
}

// In-memory session store. Key = mcp-session-id (UUID).
export const sessions = new Map<string, McpSession>();

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Evict stale sessions every 5 minutes to prevent memory leaks.
setInterval(() => {
  const cutoff = new Date(Date.now() - SESSION_TTL_MS);
  for (const [id, session] of sessions) {
    if (session.lastActiveAt < cutoff) {
      session.transport.close().catch(() => {});
      sessions.delete(id);
    }
  }
}, 5 * 60 * 1000);
