// POST /api/v1/workspaces/:id/members — directly add an existing user by email; min role: ADMIN.
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import type { Role } from '../../../../middlewares/permissionManager';
import { writeEvent } from '../../../../mods/events/index';

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
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (!body.email || typeof body.email !== 'string') {
    return Response.json(
      { error: { code: 'bad-request', message: 'email is required' } },
      { status: 400 },
    );
  }

  const role: Role = (VALID_ROLES.includes(body.role as Role) ? body.role : 'MEMBER') as Role;
  const email = body.email.trim().toLowerCase();

  // Look up the target user by email
  const user = await db('users').where({ email }).first();
  if (!user) {
    return Response.json(
      { error: { code: 'user-not-found', message: `No account found for ${email}. Ask them to sign up first.` } },
      { status: 404 },
    );
  }

  // Check if already a member
  const existing = await db('memberships')
    .where({ workspace_id: workspaceId, user_id: user.id })
    .first();

  if (existing) {
    return Response.json(
      { error: { code: 'already-a-member', message: `${email} is already a member of this workspace.` } },
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

  // Emit real-time event so connected clients learn about the new workspace member (§8).
  writeEvent({
    type: 'member_joined',
    boardId: null,
    entityId: workspaceId,
    actorId: (req as AuthenticatedRequest).currentUser!.id,
    payload: {
      scope: 'workspace',
      userId: user.id,
      displayName: (user.name as string | undefined) ?? user.email,
      role,
      joinedAt: new Date().toISOString(),
    },
  }).catch(() => {});

  return Response.json({ data: member }, { status: 201 });
}
