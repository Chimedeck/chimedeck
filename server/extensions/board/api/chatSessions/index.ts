// Board chat session API handlers — create and list sessions.
// Sprint 199 — session-scoped board chat.
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { requireBoardAccess, type BoardScopedRequest } from '../../middlewares/requireBoardAccess';
import { requireGuestCanUseBoardChat } from '../../middlewares/chatPermissions';
import {
  createBoardChatSession,
  listBoardChatSessions,
  getBoardChatSession,
  updateBoardChatSession,
} from '../../mods/chat/sessions';

// POST /api/v1/boards/:boardId/chat/sessions
export async function handleCreateSession(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardReq = req as BoardScopedRequest;
  const accessError = await requireBoardAccess(boardReq, boardId);
  if (accessError) return accessError;

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, boardReq.board!.workspace_id);
  if (membershipError) return membershipError;

  const guestAccessError = await requireGuestCanUseBoardChat(scopedReq, boardId);
  if (guestAccessError) return guestAccessError;

  let body: { name?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // name is optional — empty body is fine
    body = {};
  }

  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : undefined;

  const result = await createBoardChatSession({
    boardId,
    createdBy: (req as AuthenticatedRequest).currentUser!.id,
    ...(name ? { name } : {}),
  });

  return Response.json({ data: result.data }, { status: 201 });
}

// GET /api/v1/boards/:boardId/chat/sessions
export async function handleListSessions(req: Request, boardId: string): Promise<Response> {
  const boardReq = req as BoardScopedRequest;
  const accessError = await requireBoardAccess(boardReq, boardId);
  if (accessError) return accessError;

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, boardReq.board!.workspace_id);
  if (membershipError) return membershipError;

  const guestAccessError = await requireGuestCanUseBoardChat(scopedReq, boardId);
  if (guestAccessError) return guestAccessError;

  const result = await listBoardChatSessions({ boardId });
  return Response.json({ data: result.data });
}

// GET /api/v1/boards/:boardId/chat/sessions/:sessionId
export async function handleGetSession(
  req: Request,
  boardId: string,
  sessionId: string
): Promise<Response> {
  const boardReq = req as BoardScopedRequest;
  const accessError = await requireBoardAccess(boardReq, boardId);
  if (accessError) return accessError;

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, boardReq.board!.workspace_id);
  if (membershipError) return membershipError;

  const guestAccessError = await requireGuestCanUseBoardChat(scopedReq, boardId);
  if (guestAccessError) return guestAccessError;

  try {
    const result = await getBoardChatSession({ sessionId, boardId });
    return Response.json({ data: result.data });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 404;
    return Response.json(
      { error: { code: 'session-not-found', message: (err as Error).message } },
      { status }
    );
  }
}

// PATCH /api/v1/boards/:boardId/chat/sessions/:sessionId
export async function handleUpdateSession(
  req: Request,
  boardId: string,
  sessionId: string
): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardReq = req as BoardScopedRequest;
  const accessError = await requireBoardAccess(boardReq, boardId);
  if (accessError) return accessError;

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, boardReq.board!.workspace_id);
  if (membershipError) return membershipError;

  const guestAccessError = await requireGuestCanUseBoardChat(scopedReq, boardId);
  if (guestAccessError) return guestAccessError;

  let body: { name?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'invalid-request-body', message: 'Request body must be JSON' } },
      { status: 400 }
    );
  }

  const name = typeof body.name === 'string' ? body.name : undefined;

  try {
    const result = await updateBoardChatSession({
      sessionId,
      boardId,
      ...(typeof name === 'string' ? { name } : {}),
    });
    return Response.json({ data: result.data });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 404;
    return Response.json(
      { error: { code: 'session-not-found', message: (err as Error).message } },
      { status }
    );
  }
}
