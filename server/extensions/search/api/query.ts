// server/extensions/search/api/query.ts
// GET /api/v1/workspaces/:id/search
// Full-text search over boards and cards in a workspace.
// RBAC: VIEWER and above may search within their own workspace.
//       Board-level access rules (PUBLIC/WORKSPACE/PRIVATE/GUEST) are enforced
//       at the SQL layer inside queryWorkspaceSearch so inaccessible boards and
//       their cards are never included in the response.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { flags } from '../../../mods/flags';
import { queryWorkspaceSearch } from '../mods/queryWorkspaceSearch';
import { searchLog } from '../common/searchLogger';

const DEFAULT_LIMIT = 20;

export async function handleSearch(req: Request, workspaceId: string): Promise<Response> {
  // Guard: SEARCH_ENABLED feature flag
  const searchEnabled = await flags.isEnabled('SEARCH_ENABLED');
  if (!searchEnabled) {
    searchLog.featureDisabled({ workspaceId });
    return Response.json(
      { error: { code: 'search-not-available', message: 'Search feature is not enabled' } },
      { status: 501 },
    );
  }

  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) {
    searchLog.permissionDenied({ workspaceId, userId: undefined, reason: 'unauthenticated' });
    return authError;
  }

  const workspace = await db('workspaces').where({ id: workspaceId }).first();
  if (!workspace) {
    return Response.json(
      { error: { code: 'workspace-not-found', message: 'Workspace not found' } },
      { status: 404 },
    );
  }

  // RBAC — VIEWER is the minimum role; requireWorkspaceMembership enforces membership
  // and populates req.callerRole used by the permission-aware search mod.
  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, workspaceId);
  if (membershipError) {
    searchLog.permissionDenied({
      workspaceId,
      userId: (scopedReq.currentUser as { id?: string } | undefined)?.id,
      reason: 'not-workspace-member',
    });
    return membershipError;
  }

  const url = new URL(req.url);
  const q = url.searchParams.get('query') ?? url.searchParams.get('q') ?? '';
  const rawType = url.searchParams.get('type');
  const type = rawType === 'board' || rawType === 'card' ? rawType : null;
  const cursor = url.searchParams.get('cursor');
  const includeArchived = url.searchParams.get('includeArchived') === 'true';
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10), 100);

  const userId = scopedReq.currentUser!.id;
  const callerRole = scopedReq.callerRole!;

  searchLog.request({ workspaceId, userId, callerRole, type, limit });

  const result = await queryWorkspaceSearch({
    workspaceId,
    userId,
    callerRole,
    q,
    type,
    cursor,
    includeArchived,
    limit,
  });

  if (result.status !== 200) {
    return Response.json(
      { error: { code: result.name, message: result.message } },
      { status: result.status },
    );
  }

  searchLog.results({
    workspaceId,
    userId,
    callerRole,
    resultCount: result.data?.length ?? 0,
    hasMore: result.metadata?.hasMore ?? false,
  });

  return Response.json({ data: result.data, metadata: result.metadata });
}
