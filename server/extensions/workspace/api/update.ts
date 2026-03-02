// PATCH /api/v1/workspaces/:id — rename workspace; min role: ADMIN.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';

export async function handleUpdateWorkspace(req: Request, workspaceId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, workspaceId);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'ADMIN');
  if (roleError) return roleError;

  let body: { name?: string };
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

  const updated = await db('workspaces')
    .where({ id: workspaceId })
    .update({ name: body.name.trim() }, ['*']);

  if (!updated.length) {
    return Response.json(
      { name: 'workspace-not-found', data: { message: 'Workspace not found' } },
      { status: 404 },
    );
  }

  return Response.json({ data: updated[0] });
}
