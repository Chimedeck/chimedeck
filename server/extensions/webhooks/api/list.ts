// GET /api/v1/webhooks — list all webhooks for the authenticated user's workspace.
// signing_secret is never returned.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';

export async function handleListWebhooks(req: Request): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const url = new URL(req.url);
  const workspaceId = url.searchParams.get('workspaceId');

  if (!workspaceId) {
    return Response.json(
      { name: 'bad-request', data: { message: 'workspaceId query param is required' } },
      { status: 400 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, workspaceId);
  if (membershipError) return membershipError;

  const rows = await db('webhooks')
    .where({ workspace_id: workspaceId })
    .orderBy('created_at', 'desc')
    .select('id', 'label', 'endpoint_url', 'event_types', 'is_active', 'created_at');

  return Response.json({
    data: rows.map((r) => ({
      id: r.id,
      label: r.label,
      endpointUrl: r.endpoint_url,
      eventTypes: r.event_types,
      isActive: r.is_active,
      createdAt: r.created_at,
    })),
  });
}
