// POST /api/v1/workspaces/:id/invite — create an invite; min role: ADMIN.
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { createInvite } from '../../mods/invite/create';
import type { Role } from '../../../../middlewares/permissionManager';

const VALID_ROLES: Role[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];

export async function handleCreateInvite(req: Request, workspaceId: string): Promise<Response> {
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

  const invite = await createInvite({
    workspaceId,
    invitedEmail: body.email.trim().toLowerCase(),
    role,
  });

  return Response.json({ data: invite }, { status: 201 });
}
