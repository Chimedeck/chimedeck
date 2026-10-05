// PATCH /api/v1/boards/:boardId/chat-permissions
// Sprint 165 — updates guest chat permission toggles.
// Only ADMIN/OWNER role can update; applies toggle coupling rules automatically.
import { randomUUID } from 'crypto';
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { requireBoardAccess, type BoardScopedRequest } from '../../middlewares/requireBoardAccess';
import { CHAT_PERMISSION_DEFAULTS, normalizeChatPermissions } from '../../mods/chatPermissions';
import type { PatchBoardChatPermissionsBody } from '../../types';

export async function handlePatchChatPermissions(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardReq = req as BoardScopedRequest;
  const accessError = await requireBoardAccess(boardReq, boardId);
  if (accessError) return accessError;

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, boardReq.board!.workspace_id);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'ADMIN');
  if (roleError) return roleError;

  let body: PatchBoardChatPermissionsBody;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { name: 'invalid-request-body', data: { message: 'Request body must be JSON' } },
      { status: 400 }
    );
  }

  if (
    (body.guest_can_view !== undefined && typeof body.guest_can_view !== 'boolean') ||
    (body.guest_can_use !== undefined && typeof body.guest_can_use !== 'boolean')
  ) {
    return Response.json(
      {
        name: 'invalid-field-type',
        data: { message: 'guest_can_view and guest_can_use must be booleans' },
      },
      { status: 400 }
    );
  }

  const existing = await db('board_chat_permissions').where({ board_id: boardId }).first();

  const current = existing
    ? {
        guest_can_view: existing.guest_can_view as boolean,
        guest_can_use: existing.guest_can_use as boolean,
      }
    : { ...CHAT_PERMISSION_DEFAULTS };

  const normalized = normalizeChatPermissions(current, body);
  const now = new Date().toISOString();

  if (existing) {
    await db('board_chat_permissions')
      .where({ board_id: boardId })
      .update({ ...normalized, updated_at: now });
  } else {
    await db('board_chat_permissions').insert({
      id: randomUUID(),
      board_id: boardId,
      ...normalized,
      updated_at: now,
    });
  }

  return Response.json({
    data: {
      board_id: boardId,
      ...normalized,
      updated_at: now,
    },
  });
}
