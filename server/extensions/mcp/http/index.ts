import { randomUUID } from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
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
  // Extract the raw token so tools can make API calls as this user.
  const token = req.headers.get('Authorization')!.slice(7);
  const method = req.method.toUpperCase();

  // --- Initialize (POST, no session yet) ---
  if (method === 'POST' && !req.headers.get('mcp-session-id')) {
    const sessionId = randomUUID();
    const server = new McpServer({ name: 'chimedeck', version: '1.0.0' });
    registerMcpTools(server, token);

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => sessionId,
      onsessioninitialized: (id) => {
        sessions.set(id, { server, transport, userId, lastActiveAt: new Date() });
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
      { status: 400 },
    );
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return Response.json(
      { name: 'session-not-found', data: { message: 'Session expired or unknown. Re-initialize.' } },
      { status: 404 },
    );
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
