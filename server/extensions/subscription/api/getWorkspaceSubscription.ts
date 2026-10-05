import { env } from '../../../config/env';
import {
  getCurrentTier,
  getOrCreateByWorkspaceId,
  upsertWorkspaceSubscription,
} from '../common/subscriptionRepo';
import { mapStripePriceIdToTier } from '../common/priceTierMap';
import { serializeWorkspaceSubscriptionResponse } from '../common/serializer';
import { resolveWorkspaceContext } from '../common/workspaceResolver';

function getWorkspaceIdFromRequest(req: Request): string | null {
  const url = new URL(req.url);
  return url.searchParams.get('workspaceId');
}

async function trySyncWorkspaceSubscriptionFromStripe({
  workspaceId,
  subscription,
}: {
  workspaceId: string;
  subscription: Awaited<ReturnType<typeof getOrCreateByWorkspaceId>>;
}) {
  if (!env.SUBSCRIPTIONS_ENABLED || !env.STRIPE_SECRET_KEY) return;
  if (!subscription.stripeCustomerId) return;

  const response = await fetch(
    `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(subscription.stripeCustomerId)}&status=all&limit=10`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      },
    }
  );

  const payload = (await response.json()) as {
    data?: Array<{
      id?: string | null;
      status?: string;
      current_period_end?: number;
      items?: { data?: Array<{ price?: { id?: string | null } | null }> } | null;
    }>;
  };
  if (!response.ok) return;

  const latest = payload.data?.find((item) => item.id && item.items?.data?.[0]?.price?.id);
  if (!latest?.id || !latest.items?.data?.[0]?.price?.id) return;

  const stripePriceId = latest.items.data[0].price.id;
  const nextTier = mapStripePriceIdToTier(stripePriceId);
  const nextStatus =
    latest.status === 'active' ||
    latest.status === 'trialing' ||
    latest.status === 'past_due' ||
    latest.status === 'canceled' ||
    latest.status === 'incomplete' ||
    latest.status === 'incomplete_expired' ||
    latest.status === 'unpaid'
      ? latest.status
      : 'active';

  if (
    subscription.stripeSubscriptionId === latest.id &&
    subscription.stripePriceId === stripePriceId &&
    subscription.tier === nextTier &&
    subscription.status === nextStatus
  ) {
    return;
  }

  await upsertWorkspaceSubscription({
    workspaceId,
    tier: nextTier,
    status: nextStatus,
    stripeCustomerId: subscription.stripeCustomerId,
    stripeSubscriptionId: latest.id,
    stripePriceId,
    stripeCurrentPeriodEnd:
      typeof latest.current_period_end === 'number'
        ? new Date(latest.current_period_end * 1000).toISOString()
        : null,
  });
}

export async function handleGetWorkspaceSubscription(req: Request): Promise<Response> {
  const workspaceResolution = await resolveWorkspaceContext(req, {
    workspaceId: getWorkspaceIdFromRequest(req),
  });
  if (workspaceResolution.response) return workspaceResolution.response;
  const { context } = workspaceResolution;

  const subscription = await getOrCreateByWorkspaceId(context.workspaceId);
  await trySyncWorkspaceSubscriptionFromStripe({ workspaceId: context.workspaceId, subscription });
  const refreshedSubscription = await getOrCreateByWorkspaceId(context.workspaceId);
  const tier = await getCurrentTier(context.workspaceId);

  return Response.json({
    data: serializeWorkspaceSubscriptionResponse({
      subscription: refreshedSubscription,
      tier,
      subscriptionsEnabled: env.SUBSCRIPTIONS_ENABLED,
    }),
  });
}
