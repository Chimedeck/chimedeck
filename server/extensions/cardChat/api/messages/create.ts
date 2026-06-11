// POST /api/v1/cards/:cardId/chat/messages
// Sprint 171 — persist card-chat messages.
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { requireWorkspaceMembership, type WorkspaceScopedRequest } from '../../../../middlewares/permissionManager';
import { writeCardChatMessage } from '../../mods/messages/write';
import type { CardChatMessageRole } from '../../types';

export const cardChatCreateApiDeps = {
  authenticate,
  requireWorkspaceMembership,
  writeCardChatMessage,
};

export async function handleCreateCardChatMessage(req: Request, cardId: string): Promise<Response> {
  const authError = await cardChatCreateApiDeps.authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const authReq = req as AuthenticatedRequest;
  const workspaceReq = req as WorkspaceScopedRequest;

  // The workspace context must have been populated by the router's board-visibility check
  const membershipError = await cardChatCreateApiDeps.requireWorkspaceMembership(
    workspaceReq,
    workspaceReq.workspaceId ?? '',
  );
  if (membershipError) return membershipError;

  let body: { sessionId?: string; content?: string; role?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'invalid-request-body', data: { message: 'Request body must be JSON' } },
      { status: 400 },
    );
  }

  if (typeof body.sessionId !== 'string' || body.sessionId === '') {
    return Response.json(
      { name: 'missing-session-id', data: { message: 'sessionId is required' } },
      { status: 400 },
    );
  }

  if (typeof body.content !== 'string') {
    return Response.json(
      { name: 'invalid-content', data: { message: 'content must be a string' } },
      { status: 400 },
    );
  }

  const trimmedContent = body.content.trim();
  if (trimmedContent === '') {
    return Response.json(
      { name: 'missing-content', data: { message: 'content is required' } },
      { status: 400 },
    );
  }

  // Default role to 'user' for simplicity; AI-generated messages use 'assistant'
  const role: CardChatMessageRole =
    body.role === 'assistant' || body.role === 'system' || body.role === 'tool'
      ? body.role
      : 'user';

  try {
    const result = await cardChatCreateApiDeps.writeCardChatMessage({
      sessionId: body.sessionId,
      cardId,
      authorId: authReq.currentUser!.id,
      role,
      content: trimmedContent,
    });

    return Response.json({ data: result.data.message }, { status: result.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown-error';
    if (message === 'card-chat-session-not-found') {
      return Response.json(
        { name: 'session-not-found', data: { message: 'Chat session not found for this card' } },
        { status: 404 },
      );
    }
    if (message === 'card-chat-session-not-active') {
      return Response.json(
        {
          name: 'session-is-paused',
          data: { message: 'Cannot write messages while the session is paused' },
        },
        { status: 409 },
      );
    }
    throw error;
  }
}
