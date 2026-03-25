// POST /api/v1/workspaces/:id/labels — create a board-scoped label; requires boardId in body; min role: ADMIN.
import { randomUUID } from 'crypto';
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';

export async function handleCreateLabel(req: Request, workspaceId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const workspace = await db('workspaces').where({ id: workspaceId }).first();
  if (!workspace) {
    return Response.json(
      { error: { code: 'workspace-not-found', message: 'Workspace not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, workspaceId);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'ADMIN');
  if (roleError) return roleError;

  let body: { name?: string; color?: string; boardId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (!body.boardId || typeof body.boardId !== 'string') {
    return Response.json(
      { error: { code: 'bad-request', message: 'boardId is required — labels are board-scoped' } },
      { status: 400 },
    );
  }

  // [why] Verify the board belongs to this workspace to prevent cross-workspace label injection.
  const board = await db('boards').where({ id: body.boardId, workspace_id: workspaceId }).first();
  if (!board) {
    return Response.json(
      { error: { code: 'board-not-found', message: 'Board not found in this workspace' } },
      { status: 404 },
    );
  }

  if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
    return Response.json(
      { error: { code: 'bad-request', message: 'name is required' } },
      { status: 400 },
    );
  }

  if (!body.color || typeof body.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(body.color)) {
    return Response.json(
      { error: { code: 'bad-request', message: 'color must be a hex color (e.g. #FF5733)' } },
      { status: 400 },
    );
  }

  const id = randomUUID();
  await db('labels').insert({ id, board_id: body.boardId, name: body.name.trim(), color: body.color });

  const label = await db('labels').where({ id }).first();
  return Response.json({ data: label }, { status: 201 });
}
