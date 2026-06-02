// GET /api/v1/workspaces/:workspaceId/entitlements
// Expose workspace entitlements for current subscription tier.

import { resolveEntitlements, type WorkspaceEntitlements } from '../common/entitlements';
import { getWorkspaceUsage, type WorkspaceUsage } from '../common/usage';
import { getCurrentTier } from '../common/subscriptionRepo';
import { resolveWorkspaceContext } from '../common/workspaceResolver';

interface EntitlementsResponse {
  status: number;
  data?: {
    workspaceId: string;
    entitlements: WorkspaceEntitlements;
    usage: WorkspaceUsage;
  };
  name?: string;
  error?: { message?: string };
}

/**
 * Handle GET /api/v1/workspaces/:workspaceId/entitlements
 */
export async function handleGetEntitlements(
  req: Request,
  pathname: string,
): Promise<Response> {
  try {
    // Extract workspaceId from pathname: /api/v1/workspaces/:workspaceId/entitlements
    const match = /^\/api\/v1\/workspaces\/([^/]+)\/entitlements$/.exec(pathname);
    if (!match?.[1]) {
      return new Response(
        JSON.stringify({
          status: 400,
          name: 'invalid-path',
          data: { message: 'Invalid workspace ID in path' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const workspaceId = match[1];

    const workspaceResolution = await resolveWorkspaceContext(req, {
      workspaceId,
      minRole: 'ADMIN',
    });
    if (workspaceResolution.response) return workspaceResolution.response;

    const tier = await getCurrentTier(workspaceResolution.context.workspaceId);

    // Resolve entitlements from tier
    const entitlements = resolveEntitlements(tier);

    // Get usage for workspace
    const usage = await getWorkspaceUsage(workspaceResolution.context.workspaceId);

    return new Response(
      JSON.stringify({
        status: 200,
        data: {
          workspaceId,
          entitlements,
          usage,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        status: 500,
        name: 'entitlements-resolution-failed',
        data: { message },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
