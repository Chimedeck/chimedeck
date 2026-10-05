import { handleCreateCheckout } from './createCheckout';
import { handleCreatePortal } from './createPortal';
import { handleGetWorkspaceSubscription } from './getWorkspaceSubscription';
import { handleGetEntitlements } from './getEntitlements';
import { handleStripeWebhook } from './webhook';

export async function subscriptionRouter(req: Request, pathname: string): Promise<Response | null> {
  if (pathname === '/api/subscription/webhook' && req.method === 'POST') {
    return handleStripeWebhook(req);
  }

  if (pathname === '/api/subscription' && req.method === 'GET') {
    return handleGetWorkspaceSubscription(req);
  }

  if (pathname === '/api/subscription/checkout' && req.method === 'POST') {
    return handleCreateCheckout(req);
  }

  if (pathname === '/api/subscription/portal' && req.method === 'POST') {
    return handleCreatePortal(req);
  }

  if (pathname.match(/^\/api\/v1\/workspaces\/[^/]+\/entitlements$/) && req.method === 'GET') {
    return handleGetEntitlements(req, pathname);
  }

  return null;
}
