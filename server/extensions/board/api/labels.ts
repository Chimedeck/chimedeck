// GET  /api/v1/boards/:id/labels — list labels for the board's workspace.
// POST /api/v1/boards/:id/labels — create a label in the board's workspace.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { guestGuard } from '../../../middlewares/guestGuard';
import { requireBoardAccess, type BoardScopedRequest } from '../middlewares/requireBoardAccess';
import { randomUUID } from 'crypto';

export async function handleGetBoardLabels(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardReq = req as BoardScopedRequest;
  const accessError = await requireBoardAccess(boardReq, boardId);
  if (accessError) return accessError;

  const board = boardReq.board!;
  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'VIEWER');
  if (roleError) return roleError;

  const labels = await db('labels')
    .where({ workspace_id: board.workspace_id })
    .orderBy('name', 'asc');

  return Response.json({ data: labels });
}

export async function handleCreateBoardLabel(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardReq = req as BoardScopedRequest;
  const accessError = await requireBoardAccess(boardReq, boardId);
  if (accessError) return accessError;

  const board = boardReq.board!;
  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const guestError = guestGuard(scopedReq);
  if (guestError) return guestError;

  const roleError = requireRole(scopedReq, 'MEMBER');
  if (roleError) return roleError;

  let body: { name: string; color: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'bad-request', data: { message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
    return Response.json(
      { name: 'bad-request', data: { message: 'name is required' } },
      { status: 400 },
    );
  }

  const label = {
    id: randomUUID(),
    workspace_id: board.workspace_id,
    name: body.name.trim(),
    color: body.color ?? '#6b7280',
  };

  await db('labels').insert(label);
  return Response.json({ data: label }, { status: 201 });
}
