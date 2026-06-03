import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { requireBoardAccess, type BoardScopedRequest } from '../../middlewares/requireBoardAccess';

export async function handleGetBoardIntegrations(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardReq = req as BoardScopedRequest;
  const accessError = await requireBoardAccess(boardReq, boardId);
  if (accessError) return accessError;

  const workspaceReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(workspaceReq, boardReq.board!.workspace_id);
  if (membershipError) return membershipError;

  return Response.json({
    data: {
      github_project_url:
        ((boardReq.board as { github_project_url?: string | null }).github_project_url ?? null),
    },
  });
}
