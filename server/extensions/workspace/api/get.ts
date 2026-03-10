// GET /api/v1/workspaces       — list caller's workspaces.
// GET /api/v1/workspaces/:id   — get a single workspace (min role: VIEWER).
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';

export async function handleListWorkspaces(req: Request): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const { currentUser } = req as AuthenticatedRequest;

  const rows = await db('workspaces')
    .join('memberships', 'workspaces.id', 'memberships.workspace_id')
    .where('memberships.user_id', currentUser!.id)
    .select('workspaces.*', 'memberships.role as caller_role');

  // Map DB snake_case to camelCase expected by frontend
  const data = rows.map((r: Record<string, unknown>) => ({
    id: r.id,
    name: r.name,
    ownerId: r.owner_id,
    callerRole: r.caller_role,
    createdAt: r.created_at,
  }));

  return Response.json({ data });
}

export async function handleGetWorkspace(req: Request, workspaceId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, workspaceId);
  if (membershipError) return membershipError;

  // VIEWER and above may read — requireWorkspaceMembership already confirms membership.
  const workspace = await db('workspaces').where({ id: workspaceId }).first();

  if (!workspace) {
    return Response.json(
      { error: { code: 'workspace-not-found', message: 'Workspace not found' } },
      { status: 404 },
    );
  }

  return Response.json({
    data: {
      id: workspace.id,
      name: workspace.name,
      ownerId: workspace.owner_id,
      createdAt: workspace.created_at,
    },
  });
}
