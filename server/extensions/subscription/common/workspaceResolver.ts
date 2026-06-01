import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { hasRole, resolveHighestRole, type Role } from '../../../middlewares/permissionManager';
import type { WorkspaceContext } from './types';

interface ResolveWorkspaceOptions {
  workspaceId: string | null | undefined;
  minRole?: Role;
}

export async function resolveWorkspaceContext(
  req: Request,
  options: ResolveWorkspaceOptions,
): Promise<{ context: WorkspaceContext; response: null } | { context: null; response: Response }> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return { context: null, response: authError };

  const { currentUser } = req as AuthenticatedRequest;
  if (!currentUser) {
    return {
      context: null,
      response: Response.json({ name: 'current-user-not-found' }, { status: 401 }),
    };
  }

  if (!options.workspaceId) {
    return {
      context: null,
      response: Response.json({ name: 'workspace-id-required' }, { status: 400 }),
    };
  }

  const workspace = await db('workspaces')
    .where({ id: options.workspaceId })
    .select('id', 'name')
    .first<{ id: string; name: string }>();
  if (!workspace) {
    return {
      context: null,
      response: Response.json({ name: 'workspace-not-found' }, { status: 404 }),
    };
  }

  const memberships = await db('memberships')
    .where({ workspace_id: workspace.id, user_id: currentUser.id })
    .select('role');
  const role = resolveHighestRole(memberships.map((membership: { role: string }) => membership.role));
  if (!role) {
    return {
      context: null,
      response: Response.json({ name: 'current-user-is-not-workspace-member' }, { status: 403 }),
    };
  }

  if (options.minRole && !hasRole(role, options.minRole)) {
    return {
      context: null,
      response: Response.json(
        { name: 'current-user-is-not-workspace-admin', data: { requiredRole: options.minRole } },
        { status: 403 },
      ),
    };
  }

  return {
    context: {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      currentUserId: currentUser.id,
      currentUserEmail: currentUser.email,
      role,
    },
    response: null,
  };
}
