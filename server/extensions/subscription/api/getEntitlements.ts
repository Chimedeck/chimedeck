// GET /api/v1/workspaces/:workspaceId/entitlements
// Expose workspace entitlements for current subscription tier.

import { resolveEntitlements, type WorkspaceEntitlements } from '../common/entitlements';
import { getWorkspaceUsage, type WorkspaceUsage } from '../common/usage';
import { getByWorkspaceId } from '../common/subscriptionRepo';
import { env } from '../../../config/env';

interface EntitlementsResponse {
  status: number;
  data?: {
    workspaceId: string;
    entitlements: WorkspaceEntitlements;
    usage: WorkspaceUsage;
  };
  name?: string;
  data?: { message?: string };
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
    const match = pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/entitlements$/);
    if (!match || !match[1]) {
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

    // Get subscription for workspace
    let tier: any = 'tier_1'; // default free tier

    if (env.SUBSCRIPTIONS_ENABLED) {
      const subscription = await getByWorkspaceId(workspaceId);
      if (subscription) {
        tier = subscription.tier;
      }
    } else {
      // Fallback: if subscriptions disabled and default unlimited is enabled, use unlimited tier
      if (env.SUBSCRIPTIONS_DEFAULT_UNLIMITED_TIER) {
        tier = 'unlimited';
      }
    }

    // Resolve entitlements from tier
    const entitlements = resolveEntitlements(tier);

    // Get usage for workspace
    const usage = await getWorkspaceUsage(workspaceId);

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
