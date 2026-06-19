import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { requireBoardAccess, type BoardScopedRequest } from '../../middlewares/requireBoardAccess';
import { requireGuestCanUseBoardChat } from '../../middlewares/chatPermissions';
import { assistBoardChat } from '../../mods/chat/assist';
import { getBoardChatSession } from '../../mods/chat/sessions';

const MAX_CONTEXT_LIMIT = 50;

export const boardChatAssistApiDeps = {
  authenticate,
  requireBoardAccess,
  requireWorkspaceMembership,
  requireGuestCanUseBoardChat,
  assistBoardChat,
  getBoardChatSession,
};

interface CreateChatAssistBody {
  prompt?: unknown;
  sessionId?: unknown;
  contextLimit?: unknown;
}

export async function handleCreateChatAssist(req: Request, boardId: string): Promise<Response> {
  const authError = await boardChatAssistApiDeps.authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardReq = req as BoardScopedRequest;
  const accessError = await boardChatAssistApiDeps.requireBoardAccess(boardReq, boardId);
  if (accessError) return accessError;
  const board = boardReq.board;
  if (!board) {
    return Response.json(
      {
        error: {
          code: 'board-context-missing',
          message: 'Board context is missing after access check',
        },
      },
      { status: 500 }
    );
  }

  if (board.state === 'ARCHIVED') {
    return Response.json(
      {
        error: {
          code: 'board-is-archived',
          message: 'This board is archived and cannot accept chat assist requests.',
        },
      },
      { status: 403 }
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await boardChatAssistApiDeps.requireWorkspaceMembership(
    scopedReq,
    board.workspace_id
  );
  if (membershipError) return membershipError;

  const guestAccessError = await boardChatAssistApiDeps.requireGuestCanUseBoardChat(
    scopedReq,
    boardId
  );
  if (guestAccessError) return guestAccessError;

  let body: CreateChatAssistBody;
  try {
    body = (await req.json()) as CreateChatAssistBody;
  } catch {
    return Response.json(
      { error: { code: 'invalid-request-body', message: 'Request body must be JSON' } },
      { status: 400 }
    );
  }

  if (typeof body.prompt !== 'string') {
    return Response.json(
      { error: { code: 'invalid-field-type', message: 'prompt must be a string' } },
      { status: 400 }
    );
  }

  const prompt = body.prompt.trim();
  if (prompt === '') {
    return Response.json(
      { error: { code: 'missing-prompt', message: 'prompt is required' } },
      { status: 400 }
    );
  }

  if (typeof body.sessionId !== 'string' || body.sessionId.trim() === '') {
    return Response.json(
      {
        error: {
          code: 'missing-session-id',
          message: 'sessionId is required — create a session via POST /chat/sessions first',
        },
      },
      { status: 400 }
    );
  }

  // [why] Validate the session belongs to this board before calling assist.
  try {
    await boardChatAssistApiDeps.getBoardChatSession({ sessionId: body.sessionId, boardId });
  } catch {
    return Response.json(
      { error: { code: 'session-not-found', message: 'Session not found for this board' } },
      { status: 404 }
    );
  }

  let contextLimit: number | undefined;
  if (typeof body.contextLimit !== 'undefined') {
    if (typeof body.contextLimit !== 'number' || !Number.isFinite(body.contextLimit)) {
      return Response.json(
        { error: { code: 'invalid-field-type', message: 'contextLimit must be a number' } },
        { status: 400 }
      );
    }
    const normalized = Math.floor(body.contextLimit);
    if (normalized < 1 || normalized > MAX_CONTEXT_LIMIT) {
      return Response.json(
        {
          error: {
            code: 'context-limit-out-of-range',
            message: `contextLimit must be between 1 and ${String(MAX_CONTEXT_LIMIT)}`,
          },
        },
        { status: 400 }
      );
    }
    contextLimit = normalized;
  }

  const assistInput = {
    boardId,
    sessionId: body.sessionId,
    prompt,
    ...(typeof contextLimit === 'number' ? { contextLimit } : {}),
    request: req,
    actorId: (req as AuthenticatedRequest).currentUser!.id,
    board,
  };

  let result: Awaited<ReturnType<typeof boardChatAssistApiDeps.assistBoardChat>>;
  try {
    result = await boardChatAssistApiDeps.assistBoardChat(assistInput);
  } catch (err) {
    // [why] Catch thrown exceptions (e.g. DB failures, provider timeouts) so
    // the client always gets a structured error response instead of a silent hang.
    console.error(
      `[chat/assist] Unhandled exception: ${err instanceof Error ? err.message : String(err)}`
    );
    return Response.json(
      {
        error: {
          code: 'board-chat-assist-failed',
          message: 'Board chat assist request failed due to an internal error',
        },
      },
      { status: 500 }
    );
  }

  if (result.status !== 200) {
    console.log(`==debug - result:`, result);
    if (result.status >= 500) {
      console.error(
        `[chat/assist] 5xx from assist handler: status=${String(result.status)} name=${result.name ?? ''} message=${result.message ?? ''}`
      );
    }
    return Response.json(
      {
        error: {
          code: result.name ?? 'board-chat-assist-failed',
          message: result.message ?? 'Board chat assist request failed',
        },
      },
      { status: result.status }
    );
  }

  return Response.json({ data: result.data });
}
