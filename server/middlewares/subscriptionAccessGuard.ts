import { env } from '../config/env';
import type { RequestWorkspaceContext } from '../common/requestContext';
import { getWorkspaceBillingEnforcement } from '../extensions/subscription/common/enforcement';

function isSubscriptionRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/api/subscription') ||
    /\/api\/v1\/workspaces\/[^/]+\/entitlements$/.test(pathname)
  );
}

function isBoardScopedRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/api/v1/boards/') ||
    pathname.startsWith('/api/v1/lists/') ||
    pathname.startsWith('/api/v1/cards/') ||
    /^\/api\/v1\/workspaces\/[^/]+\/boards$/.test(pathname)
  );
}

export async function applySubscriptionAccessGuard(
  req: Request,
  workspaceContext: RequestWorkspaceContext
): Promise<Response | null> {
  if (!env.SUBSCRIPTIONS_ENABLED) return null;

  const { pathname } = new URL(req.url);
  if (isSubscriptionRoute(pathname)) return null;
  if (!isBoardScopedRoute(pathname)) return null;

  const workspaceId = workspaceContext.workspaceId;
  if (!workspaceId) return null;

  const enforcement = await getWorkspaceBillingEnforcement(workspaceId);

  // [why] Only block hard-lock statuses (canceled, unpaid, etc.).
  // Individual resource limits (boards, lists, members, storage) are enforced
  // per-endpoint by applyLimitGuard — we must not lump them together here.
  // A workspace that hit its board limit should still be able to create lists.
  if (enforcement.mode === 'blocked') {
    return Response.json(
      {
        error: {
          code: enforcement.code,
          message: enforcement.message,
          data: {
            workspaceId,
            mode: enforcement.mode,
            upgradeUrl: enforcement.upgradeUrl,
          },
        },
      },
      { status: 402 }
    );
  }

  return null;
}
