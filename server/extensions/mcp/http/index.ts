import { randomUUID } from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {
  authenticate,
  parseBearerToken,
  type AuthenticatedRequest,
} from '../../auth/middlewares/authentication';
import { registerMcpTools } from '../registerTools';
import { initSession, getSession, deleteSession, startEvictionLoop } from './sessions';

// [why] Start the periodic DB + local-cache eviction loop once at module load.
// Bun's module cache ensures this only runs once regardless of hot-reloads.
startEvictionLoop();

export async function mcpHttpHandler(req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  if (!url.pathname.startsWith('/api/mcp')) return null;

  // Auth first — deny before any MCP logic.
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const currentUser = (req as AuthenticatedRequest).currentUser;
  if (!currentUser) {
    return Response.json(
      { error: { code: 'unauthorized', message: 'Not authenticated' } },
      { status: 401 }
    );
  }
  const userId = currentUser.id;
  // Extract the raw token so tools can make API calls as this user.
  const token = parseBearerToken(req.headers.get('Authorization'));
  if (!token) {
    return Response.json(
      { error: { code: 'unauthorized', message: 'Missing Bearer token' } },
      { status: 401 }
    );
  }
  const method = req.method.toUpperCase();

  // --- Initialize (POST, no session yet) ---
  if (method === 'POST' && !req.headers.get('mcp-session-id')) {
    const sessionId = randomUUID();
    const server = new McpServer({ name: 'chimedeck', version: '1.0.0' });
    registerMcpTools(server, token);

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => sessionId,
      onsessioninitialized: (id) => {
        // [why] Local transport cache must be set synchronously (callback fires
        // during handleRequest which returns a Response). DB persistence is
        // fire-and-forget — if it fails, the session is just invisible to other
        // instances until the next request, which is acceptable.
        initSession(id, userId, server, transport).catch(() => {});
      },
    });

    // [why] Connect the server to the transport before handling the request so
    // tool registrations are active when the initialize response is sent.
    await server.connect(transport);

    return transport.handleRequest(req);
  }

  // --- Subsequent requests — resolve session ---
  const sessionId = req.headers.get('mcp-session-id');
  if (!sessionId) {
    return Response.json(
      { name: 'bad-request', data: { message: 'mcp-session-id header required' } },
      { status: 400 }
    );
  }

  const session = await getSession(sessionId);
  if (!session) {
    return Response.json(
      {
        name: 'session-not-found',
        data: { message: 'Session expired or unknown. Re-initialize.' },
      },
      { status: 404 }
    );
  }

  // Prevent session hijacking — token owner must match session owner.
  if (session.userId !== userId) {
    return Response.json({ name: 'forbidden' }, { status: 403 });
  }

  // [why] If another instance owns the transport, tell the client to re-initialize.
  // The session exists in the DB but not on this machine — standard MCP pattern
  // for horizontal scaling without sticky sessions.
  if (!session.transport) {
    return Response.json(
      {
        name: 'session-not-found',
        data: { message: 'Session on another instance. Re-initialize.' },
      },
      { status: 404 }
    );
  }

  if (method === 'DELETE') {
    await deleteSession(sessionId);
    return new Response(null, { status: 204 });
  }

  // POST (tool call / notification) or GET (SSE stream)
  return session.transport.handleRequest(req);
}
