import { env } from '../../../config/env';
import { getOrCreateByWorkspaceId, upsertWorkspaceSubscription } from '../common/subscriptionRepo';
import { mapStripePriceIdToTier } from '../common/priceTierMap';
import { resolveWorkspaceContext } from '../common/workspaceResolver';
import type { SubscriptionTier } from '../common/types';

type CheckoutTier = Extract<SubscriptionTier, 'tier_2' | 'tier_3' | 'tier_4'>;

type StripeSubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid';

function normalizeOrigin(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function resolveClientAppOrigin(req: Request): string {
  const origin = normalizeOrigin(req.headers.get('origin'));
  if (origin) return origin;

  const referer = normalizeOrigin(req.headers.get('referer'));
  if (referer) return referer;

  return env.APP_URL;
}

function getPriceIdByTier(tier: CheckoutTier): string {
  if (tier === 'tier_2') return env.STRIPE_PRICE_TIER_2;
  if (tier === 'tier_3') return env.STRIPE_PRICE_TIER_3;
  return env.STRIPE_PRICE_TIER_4;
}

function getBillingReturnUrl(appOrigin: string, workspaceId: string): string {
  return `${appOrigin}/workspace/${workspaceId}/billing?checkout=success`;
}

async function createStripeCustomer({
  userId,
  userEmail,
}: {
  userId: string;
  userEmail: string;
}): Promise<string> {
  const body = new URLSearchParams();
  body.set('email', userEmail);
  body.set('metadata[userId]', userId);

  const response = await fetch('https://api.stripe.com/v1/customers', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const payload = (await response.json()) as { id?: string; error?: { message?: string } };
  if (!response.ok || !payload.id) {
    throw new Error(payload.error?.message ?? 'stripe-customer-create-failed');
  }

  return payload.id;
}

async function createStripeCheckoutSession({
  userId,
  workspaceId,
  customerId,
  priceId,
  appOrigin,
}: {
  userId: string;
  workspaceId: string;
  customerId: string;
  priceId: string;
  appOrigin: string;
}): Promise<string> {
  const body = new URLSearchParams();
  body.set('mode', 'subscription');
  body.set('customer', customerId);
  body.set('success_url', `${appOrigin}/workspace/${workspaceId}/billing?checkout=success`);
  body.set('cancel_url', `${appOrigin}/workspace/${workspaceId}/billing?checkout=cancel`);
  body.set('line_items[0][price]', priceId);
  body.set('line_items[0][quantity]', '1');
  body.set('subscription_data[metadata][userId]', userId);
  body.set('subscription_data[metadata][workspaceId]', workspaceId);
  body.set('metadata[userId]', userId);
  body.set('metadata[workspaceId]', workspaceId);

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const payload = (await response.json()) as { url?: string; error?: { message?: string } };
  if (!response.ok || !payload.url) {
    throw new Error(payload.error?.message ?? 'stripe-checkout-session-create-failed');
  }

  return payload.url;
}

async function getStripeSubscriptionItemId(subscriptionId: string): Promise<string> {
  const response = await fetch(
    `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      },
    }
  );

  const payload = (await response.json()) as {
    items?: { data?: Array<{ id?: string | null }> | null } | null;
    error?: { message?: string };
  };

  const itemId = payload.items?.data?.[0]?.id;
  if (!response.ok || !itemId) {
    throw new Error(payload.error?.message ?? 'stripe-subscription-item-not-found');
  }

  return itemId;
}

async function updateStripeSubscriptionPrice({
  subscriptionId,
  itemId,
  priceId,
}: {
  subscriptionId: string;
  itemId: string;
  priceId: string;
}): Promise<void> {
  const body = new URLSearchParams();
  body.set('items[0][id]', itemId);
  body.set('items[0][price]', priceId);
  body.set('proration_behavior', 'create_prorations');

  const response = await fetch(
    `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    }
  );

  if (!response.ok) {
    const payload = (await response.json()) as { error?: { message?: string } };
    throw new Error(payload.error?.message ?? 'stripe-subscription-update-failed');
  }
}

function toInternalStatus(status: string | undefined): StripeSubscriptionStatus {
  if (
    status === 'active' ||
    status === 'trialing' ||
    status === 'past_due' ||
    status === 'canceled' ||
    status === 'incomplete' ||
    status === 'incomplete_expired' ||
    status === 'unpaid'
  ) {
    return status;
  }
  return 'active';
}

async function getLatestStripeSubscriptionByCustomer(customerId: string): Promise<{
  id: string;
  itemId: string;
  priceId: string | null;
  status: StripeSubscriptionStatus;
  currentPeriodEnd: string | null;
} | null> {
  const response = await fetch(
    `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(customerId)}&status=all&limit=10`,
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
      items?: {
        data?: Array<{ id?: string | null; price?: { id?: string | null } | null }>;
      } | null;
    }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? 'stripe-subscription-list-failed');
  }

  const candidate = payload.data?.find(
    (subscription) => subscription.id && subscription.items?.data?.[0]?.id
  );
  if (!candidate?.id || !candidate.items?.data?.[0]?.id) return null;

  return {
    id: candidate.id,
    itemId: candidate.items.data[0].id,
    priceId: candidate.items.data[0].price?.id ?? null,
    status: toInternalStatus(candidate.status),
    currentPeriodEnd:
      typeof candidate.current_period_end === 'number'
        ? new Date(candidate.current_period_end * 1000).toISOString()
        : null,
  };
}

async function handleExistingWorkspaceSubscriptionChange({
  workspaceId,
  billingSubscription,
  targetTier,
  targetPriceId,
  billingReturnUrl,
}: {
  workspaceId: string;
  billingSubscription: Awaited<ReturnType<typeof getOrCreateByWorkspaceId>>;
  targetTier: CheckoutTier;
  targetPriceId: string;
  billingReturnUrl: string;
}): Promise<Response | null> {
  if (billingSubscription.stripeCustomerId && !billingSubscription.stripeSubscriptionId) {
    const latest = await getLatestStripeSubscriptionByCustomer(
      billingSubscription.stripeCustomerId
    );
    if (latest) {
      const latestTier = mapStripePriceIdToTier(latest.priceId);
      await upsertWorkspaceSubscription({
        workspaceId,
        tier: latestTier,
        status: latest.status,
        stripeCustomerId: billingSubscription.stripeCustomerId,
        stripeSubscriptionId: latest.id,
        stripePriceId: latest.priceId,
        stripeCurrentPeriodEnd: latest.currentPeriodEnd,
      });

      if (latest.priceId !== targetPriceId) {
        await updateStripeSubscriptionPrice({
          subscriptionId: latest.id,
          itemId: latest.itemId,
          priceId: targetPriceId,
        });

        await upsertWorkspaceSubscription({
          workspaceId,
          tier: targetTier,
          status: latest.status,
          stripeCustomerId: billingSubscription.stripeCustomerId,
          stripeSubscriptionId: latest.id,
          stripePriceId: targetPriceId,
          stripeCurrentPeriodEnd: latest.currentPeriodEnd,
        });
      }

      return Response.json({ data: { url: billingReturnUrl } });
    }
  }

  if (billingSubscription.stripeSubscriptionId && billingSubscription.stripeCustomerId) {
    if (billingSubscription.stripePriceId !== targetPriceId) {
      const itemId = await getStripeSubscriptionItemId(billingSubscription.stripeSubscriptionId);
      await updateStripeSubscriptionPrice({
        subscriptionId: billingSubscription.stripeSubscriptionId,
        itemId,
        priceId: targetPriceId,
      });

      await upsertWorkspaceSubscription({
        workspaceId,
        tier: targetTier,
        status: billingSubscription.status,
        stripeCustomerId: billingSubscription.stripeCustomerId,
        stripeSubscriptionId: billingSubscription.stripeSubscriptionId,
        stripePriceId: targetPriceId,
        stripeCurrentPeriodEnd: billingSubscription.stripeCurrentPeriodEnd,
      });
    }

    return Response.json({ data: { url: billingReturnUrl } });
  }

  return null;
}

export async function handleCreateCheckout(req: Request): Promise<Response> {
  if (!env.SUBSCRIPTIONS_ENABLED) {
    return Response.json({ name: 'subscriptions-disabled' }, { status: 503 });
  }

  if (!env.STRIPE_SECRET_KEY) {
    return Response.json({ name: 'stripe-not-configured' }, { status: 503 });
  }

  let body: { workspaceId?: string; tier?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'bad-request', data: { message: 'Invalid JSON body' } },
      { status: 400 }
    );
  }

  const workspaceResolution = await resolveWorkspaceContext(req, {
    workspaceId: body.workspaceId,
  });
  if (workspaceResolution.response) return workspaceResolution.response;
  const { context } = workspaceResolution;

  const tier = (body.tier ?? 'tier_2') as CheckoutTier;
  if (!['tier_2', 'tier_3', 'tier_4'].includes(tier)) {
    return Response.json({ name: 'invalid-tier', data: { tier } }, { status: 400 });
  }

  const priceId = getPriceIdByTier(tier);
  if (!priceId) {
    return Response.json({ name: 'stripe-price-not-configured', data: { tier } }, { status: 503 });
  }

  try {
    const appOrigin = resolveClientAppOrigin(req);
    const subscription = await getOrCreateByWorkspaceId(context.workspaceId);
    const existingChangeResponse = await handleExistingWorkspaceSubscriptionChange({
      workspaceId: context.workspaceId,
      billingSubscription: subscription,
      targetTier: tier,
      targetPriceId: priceId,
      billingReturnUrl: getBillingReturnUrl(appOrigin, context.workspaceId),
    });
    if (existingChangeResponse) return existingChangeResponse;

    const customerId =
      subscription.stripeCustomerId ??
      (await createStripeCustomer({
        userId: context.ownerUserId,
        userEmail: context.ownerUserEmail ?? context.currentUserEmail,
      }));

    if (!subscription.stripeCustomerId) {
      await upsertWorkspaceSubscription({
        workspaceId: context.workspaceId,
        tier: subscription.tier,
        status: subscription.status,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        stripePriceId: subscription.stripePriceId,
        stripeCurrentPeriodEnd: subscription.stripeCurrentPeriodEnd,
      });
    }

    const url = await createStripeCheckoutSession({
      userId: context.ownerUserId,
      workspaceId: context.workspaceId,
      customerId,
      priceId,
      appOrigin,
    });

    return Response.json({ data: { url } });
  } catch (error) {
    return Response.json(
      {
        name: 'stripe-error',
        data: { message: error instanceof Error ? error.message : 'Stripe request failed' },
      },
      { status: 502 }
    );
  }
}
