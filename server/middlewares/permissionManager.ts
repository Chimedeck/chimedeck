// RBAC middleware — enforces role hierarchy on workspace-scoped routes.
// Attach after authentication.ts; assumes req.currentUser is populated.
import type { AuthenticatedRequest } from '../extensions/auth/middlewares/authentication';
import { db } from '../common/db';

export type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'GUEST';

// Numeric rank — higher value = more privileged.
// GUEST has rank 0 — below all workspace roles; read-only, board-scoped only.
const ROLE_RANK: Record<Role, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
  GUEST: 0,
};

export function roleRank(role: Role): number {
  return ROLE_RANK[role];
}

// Returns true when the caller's role satisfies the minimum required role.
export function hasRole(callerRole: Role, minRole: Role): boolean {
  return roleRank(callerRole) >= roleRank(minRole);
}

export interface WorkspaceScopedRequest extends AuthenticatedRequest {
  workspaceId?: string;
  callerRole?: Role;
}

// Resolves workspaceId from URL params or body, then loads the caller's membership.
// Returns null on success (populates req.workspaceId and req.callerRole), or a 403/404 Response.
export async function requireWorkspaceMembership(
  req: WorkspaceScopedRequest,
  workspaceId: string,
): Promise<Response | null> {
  if (!req.currentUser) {
    return Response.json(
      { name: 'unauthorized', data: { message: 'Authentication required' } },
      { status: 401 },
    );
  }

  const membership = await db('memberships')
    .where({ user_id: req.currentUser.id, workspace_id: workspaceId })
    .first();

  if (!membership) {
    return Response.json(
      { name: 'insufficient-role', data: { message: 'You are not a member of this workspace' } },
      { status: 403 },
    );
  }

  req.workspaceId = workspaceId;
  req.callerRole = membership.role as Role;
  return null;
}

// Returns null on success, or a 403 Response when caller lacks the minimum role.
// Must be called after requireWorkspaceMembership() has populated req.callerRole.
export function requireRole(
  req: WorkspaceScopedRequest,
  minRole: Role,
): Response | null {
  if (!req.callerRole || !hasRole(req.callerRole, minRole)) {
    return Response.json(
      { name: 'insufficient-role', data: { message: `Requires at least ${minRole} role` } },
      { status: 403 },
    );
  }
  return null;
}
