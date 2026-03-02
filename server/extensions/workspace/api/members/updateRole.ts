// PATCH /api/v1/workspaces/:id/members/:userId — change a member's role; min role: ADMIN.
// Invariant: demoting the last OWNER returns 409.
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
  type Role,
} from '../../../../middlewares/permissionManager';

const VALID_ROLES: Role[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];

export async function handleUpdateMemberRole(
  req: Request,
  workspaceId: string,
  userId: string,
): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, workspaceId);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'ADMIN');
  if (roleError) return roleError;

  let body: { role?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'bad-request', data: { message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (!body.role || !VALID_ROLES.includes(body.role as Role)) {
    return Response.json(
      { name: 'bad-request', data: { message: `role must be one of: ${VALID_ROLES.join(', ')}` } },
      { status: 400 },
    );
  }

  const targetMembership = await db('memberships')
    .where({ user_id: userId, workspace_id: workspaceId })
    .first();

  if (!targetMembership) {
    return Response.json(
      { name: 'member-not-found', data: { message: 'User is not a member of this workspace' } },
      { status: 404 },
    );
  }

  const newRole = body.role as Role;

  // Invariant: workspace must always have ≥ 1 OWNER.
  if (targetMembership.role === 'OWNER' && newRole !== 'OWNER') {
    const ownerCount = await db('memberships')
      .where({ workspace_id: workspaceId, role: 'OWNER' })
      .count('user_id as count')
      .first();

    if (Number(ownerCount?.count ?? 0) <= 1) {
      return Response.json(
        { name: 'workspace-must-have-owner', data: { message: 'Cannot demote the last owner' } },
        { status: 409 },
      );
    }
  }

  const updated = await db('memberships')
    .where({ user_id: userId, workspace_id: workspaceId })
    .update({ role: newRole }, ['*']);

  return Response.json({ data: updated[0] });
}
