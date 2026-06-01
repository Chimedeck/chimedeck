import { env } from '../../../config/env';
import {
  getCurrentTier,
  getOrCreateByWorkspaceId,
} from '../common/subscriptionRepo';
import { serializeWorkspaceSubscriptionResponse } from '../common/serializer';
import { resolveWorkspaceContext } from '../common/workspaceResolver';

function getWorkspaceIdFromRequest(req: Request): string | null {
  const url = new URL(req.url);
  return url.searchParams.get('workspaceId');
}

export async function handleGetWorkspaceSubscription(req: Request): Promise<Response> {
  const workspaceResolution = await resolveWorkspaceContext(req, {
    workspaceId: getWorkspaceIdFromRequest(req),
    minRole: 'GUEST',
  });
  if (workspaceResolution.response) return workspaceResolution.response;
  const { context } = workspaceResolution;

  const subscription = await getOrCreateByWorkspaceId(context.workspaceId);
  const tier = await getCurrentTier(context.workspaceId);

  return Response.json({
    data: serializeWorkspaceSubscriptionResponse({
      subscription,
      tier,
      subscriptionsEnabled: env.SUBSCRIPTIONS_ENABLED,
    }),
  });
}
