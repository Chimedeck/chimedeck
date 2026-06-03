// POST /api/v1/boards/:boardId/chat/search
import { requireWorkspaceMembership, type WorkspaceScopedRequest } from '../../../../middlewares/permissionManager';
import { requireBoardAccess, type BoardScopedRequest } from '../../middlewares/requireBoardAccess';
import { requireGuestCanViewBoardChat } from '../../middlewares/chatPermissions';
import { searchBoardChatMessages } from '../../mods/chat/search/query';

const DEFAULT_LIMIT = 20;

export const boardChatSearchApiDeps = {
  requireBoardAccess,
  requireWorkspaceMembership,
  requireGuestCanViewBoardChat,
  searchBoardChatMessages,
};

export async function handleCreateChatSearch(req: Request, boardId: string): Promise<Response> {
  const boardReq = req as BoardScopedRequest;
  const accessError = await boardChatSearchApiDeps.requireBoardAccess(boardReq, boardId);
  if (accessError) return accessError;

  const workspaceReq = req as WorkspaceScopedRequest;
  const membershipError = await boardChatSearchApiDeps.requireWorkspaceMembership(workspaceReq, boardReq.board!.workspace_id);
  if (membershipError) return membershipError;

  const guestError = await boardChatSearchApiDeps.requireGuestCanViewBoardChat(workspaceReq, boardId);
  if (guestError) return guestError;

  let body: { query?: string; q?: string; limit?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'invalid-request-body', message: 'Request body must be JSON' } },
      { status: 400 },
    );
  }

  const query = typeof body.query === 'string' ? body.query : typeof body.q === 'string' ? body.q : '';
  const parsedLimit = typeof body.limit === 'number' && Number.isFinite(body.limit) ? Math.floor(body.limit) : DEFAULT_LIMIT;
  const result = await boardChatSearchApiDeps.searchBoardChatMessages({
    boardId,
    query,
    limit: parsedLimit,
  });

  if (result.status !== 200) {
    return Response.json(
      { error: { code: result.name, message: result.message } },
      { status: result.status },
    );
  }

  return Response.json({ data: result.data });
}
