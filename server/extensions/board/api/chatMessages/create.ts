// POST /api/v1/boards/:boardId/chat/messages
// Sprint 166 — persists raw chat messages and best-effort embeddings.
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { requireWorkspaceMembership, type WorkspaceScopedRequest } from '../../../../middlewares/permissionManager';
import { requireBoardAccess, type BoardScopedRequest } from '../../middlewares/requireBoardAccess';
import { requireGuestCanUseBoardChat } from '../../middlewares/chatPermissions';
import { writeBoardChatMessage } from '../../mods/chat/messages/write';

export const boardChatApiDeps = {
  authenticate,
  requireBoardAccess,
  requireWorkspaceMembership,
  requireGuestCanUseBoardChat,
  writeBoardChatMessage,
};

export async function handleCreateChatMessage(req: Request, boardId: string): Promise<Response> {
  const authError = await boardChatApiDeps.authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardReq = req as BoardScopedRequest;
  const accessError = await boardChatApiDeps.requireBoardAccess(boardReq, boardId);
  if (accessError) return accessError;

  if (boardReq.board!.state === 'ARCHIVED') {
    return Response.json(
      {
        error: {
          code: 'board-is-archived',
          message: 'This board is archived and cannot accept chat messages.',
        },
      },
      { status: 403 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await boardChatApiDeps.requireWorkspaceMembership(scopedReq, boardReq.board!.workspace_id);
  if (membershipError) return membershipError;

  const guestAccessError = await boardChatApiDeps.requireGuestCanUseBoardChat(scopedReq, boardId);
  if (guestAccessError) return guestAccessError;

  let body: { content?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'invalid-request-body', message: 'Request body must be JSON' } },
      { status: 400 },
    );
  }

  if (typeof body.content !== 'string') {
    return Response.json(
      { error: { code: 'invalid-field-type', message: 'content must be a string' } },
      { status: 400 },
    );
  }

  const trimmedContent = body.content.trim();
  if (trimmedContent === '') {
    return Response.json(
      { error: { code: 'missing-content', message: 'content is required' } },
      { status: 400 },
    );
  }

  const result = await boardChatApiDeps.writeBoardChatMessage({
    boardId,
    authorId: (req as AuthenticatedRequest).currentUser!.id,
    content: trimmedContent,
  });

  return Response.json({ data: result.data.message }, { status: result.status });
}
