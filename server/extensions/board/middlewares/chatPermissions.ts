import { db } from '../../../common/db';
import type { WorkspaceScopedRequest } from '../../../middlewares/permissionManager';
import { canGuestUseBoardChat, canGuestViewBoardChat } from '../mods/chatPermissions';
import type { BoardChatPermissions } from '../types';

function requireAuthenticatedChatCaller(req: WorkspaceScopedRequest): Response | null {
  if (!req.currentUser) {
    return Response.json(
      { name: 'unauthorized', data: { message: 'Authentication required' } },
      { status: 401 },
    );
  }

  if (!req.callerRole) {
    return Response.json(
      { name: 'insufficient-permissions', data: { message: 'Missing workspace access context' } },
      { status: 403 },
    );
  }

  return null;
}

export async function requireGuestCanViewBoardChat(
  req: WorkspaceScopedRequest,
  boardId: string,
): Promise<Response | null> {
  const authError = requireAuthenticatedChatCaller(req);
  if (authError) return authError;

  if (req.callerRole !== 'GUEST') return null;

  const rowRaw = await db('board_chat_permissions').where({ board_id: boardId }).first();
  const row = rowRaw as Partial<Pick<BoardChatPermissions, 'guest_can_view' | 'guest_can_use'>> | null | undefined;
  if (!canGuestViewBoardChat(row)) {
    return Response.json(
      {
        name: 'guest-chat-view-denied',
        data: { message: 'Guest does not have permission to view board chat history' },
      },
      { status: 403 },
    );
  }

  return null;
}

export async function requireGuestCanUseBoardChat(
  req: WorkspaceScopedRequest,
  boardId: string,
): Promise<Response | null> {
  const authError = requireAuthenticatedChatCaller(req);
  if (authError) return authError;

  if (req.callerRole !== 'GUEST') return null;

  const rowRaw = await db('board_chat_permissions').where({ board_id: boardId }).first();
  const row = rowRaw as Partial<Pick<BoardChatPermissions, 'guest_can_view' | 'guest_can_use'>> | null | undefined;
  if (!canGuestUseBoardChat(row)) {
    return Response.json(
      {
        name: 'guest-chat-use-denied',
        data: { message: 'Guest does not have permission to send board chat messages' },
      },
      { status: 403 },
    );
  }

  return null;
}
