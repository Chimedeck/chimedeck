// Workspace API router — mounts all workspace and invite routes.
import { handleCreateWorkspace } from './create';
import { handleListWorkspaces, handleGetWorkspace } from './get';
import { handleUpdateWorkspace } from './update';
import { handleDeleteWorkspace } from './delete';
import { handleCreateInvite } from './invite/create';
import { handleInspectInvite } from './invite/inspect';
import { handleAcceptInvite } from './invite/accept';
import { handleListMembers } from './members/list';
import { handleAddMember } from './members/add';
import { handleUpdateMemberRole } from './members/updateRole';
import { handleRemoveMember } from './members/remove';

// Returns a Response if the path matches a workspace or invite route, otherwise null.
export async function workspaceRouter(req: Request, pathname: string): Promise<Response | null> {
  // POST /api/v1/workspaces
  if (pathname === '/api/v1/workspaces' && req.method === 'POST') {
    return handleCreateWorkspace(req);
  }

  // GET /api/v1/workspaces
  if (pathname === '/api/v1/workspaces' && req.method === 'GET') {
    return handleListWorkspaces(req);
  }

  // Routes with a workspace ID segment.
  const workspaceMatch = pathname.match(/^\/api\/v1\/workspaces\/([^/]+)(\/.*)?$/);
  if (workspaceMatch) {
    const workspaceId = workspaceMatch[1] as string;
    const sub = workspaceMatch[2] ?? '';

    // GET /api/v1/workspaces/:id
    if (sub === '' && req.method === 'GET') {
      return handleGetWorkspace(req, workspaceId);
    }

    // PATCH /api/v1/workspaces/:id
    if (sub === '' && req.method === 'PATCH') {
      return handleUpdateWorkspace(req, workspaceId);
    }

    // DELETE /api/v1/workspaces/:id
    if (sub === '' && req.method === 'DELETE') {
      return handleDeleteWorkspace(req, workspaceId);
    }

    // POST /api/v1/workspaces/:id/invite
    if (sub === '/invite' && req.method === 'POST') {
      return handleCreateInvite(req, workspaceId);
    }

    // GET /api/v1/workspaces/:id/members
    if (sub === '/members' && req.method === 'GET') {
      return handleListMembers(req, workspaceId);
    }

    // POST /api/v1/workspaces/:id/members — directly add existing user by email
    if (sub === '/members' && req.method === 'POST') {
      return handleAddMember(req, workspaceId);
    }

    // Member sub-routes with userId.
    const memberMatch = sub.match(/^\/members\/([^/]+)$/);
    if (memberMatch) {
      const userId = memberMatch[1] as string;

      // PATCH /api/v1/workspaces/:id/members/:userId
      if (req.method === 'PATCH') {
        return handleUpdateMemberRole(req, workspaceId, userId);
      }

      // DELETE /api/v1/workspaces/:id/members/:userId
      if (req.method === 'DELETE') {
        return handleRemoveMember(req, workspaceId, userId);
      }
    }
  }

  // GET /api/v1/invites/:token
  const inspectMatch = pathname.match(/^\/api\/v1\/invites\/([^/]+)$/);
  if (inspectMatch && req.method === 'GET') {
    return handleInspectInvite(req, inspectMatch[1] as string);
  }

  // POST /api/v1/invites/:token/accept
  const acceptMatch = pathname.match(/^\/api\/v1\/invites\/([^/]+)\/accept$/);
  if (acceptMatch && req.method === 'POST') {
    return handleAcceptInvite(req, acceptMatch[1] as string);
  }

  return null;
}
