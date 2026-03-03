// POST /api/v1/workspaces/:id/members — directly add an existing user by email; min role: ADMIN.
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import type { Role } from '../../../../middlewares/permissionManager';

const VALID_ROLES: Role[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];

export async function handleAddMember(req: Request, workspaceId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, workspaceId);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'ADMIN');
  if (roleError) return roleError;

  let body: { email?: string; role?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'bad-request', data: { message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (!body.email || typeof body.email !== 'string') {
    return Response.json(
      { name: 'bad-request', data: { message: 'email is required' } },
      { status: 400 },
    );
  }

  const role: Role = (VALID_ROLES.includes(body.role as Role) ? body.role : 'MEMBER') as Role;
  const email = body.email.trim().toLowerCase();

  // Look up the target user by email
  const user = await db('users').where({ email }).first();
  if (!user) {
    return Response.json(
      { name: 'user-not-found', data: { message: `No account found for ${email}. Ask them to sign up first.` } },
      { status: 404 },
    );
  }

  // Check if already a member
  const existing = await db('memberships')
    .where({ workspace_id: workspaceId, user_id: user.id })
    .first();

  if (existing) {
    return Response.json(
      { name: 'already-a-member', data: { message: `${email} is already a member of this workspace.` } },
      { status: 409 },
    );
  }

  await db('memberships').insert({
    workspace_id: workspaceId,
    user_id: user.id,
    role,
  });

  const member = {
    userId: user.id,
    email: user.email,
    name: user.name ?? user.email,
    role,
  };

  return Response.json({ data: member }, { status: 201 });
}
