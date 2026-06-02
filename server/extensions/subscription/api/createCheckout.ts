import { env } from '../../../config/env';
import { getOrCreateByWorkspaceId, upsertWorkspaceSubscription } from '../common/subscriptionRepo';
import { resolveWorkspaceContext } from '../common/workspaceResolver';
import type { SubscriptionTier } from '../common/types';

type CheckoutTier = Extract<SubscriptionTier, 'tier_2' | 'unlimited'>;

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
  return env.STRIPE_PRICE_TIER_4;
}

async function createStripeCustomer({
  workspaceId,
  workspaceName,
  currentUserEmail,
}: {
  workspaceId: string;
  workspaceName: string;
  currentUserEmail: string;
}): Promise<string> {
  const body = new URLSearchParams();
  body.set('email', currentUserEmail);
  body.set('name', workspaceName);
  body.set('metadata[workspaceId]', workspaceId);

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
  workspaceId,
  customerId,
  priceId,
  appOrigin,
}: {
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
    return Response.json({ name: 'bad-request', data: { message: 'Invalid JSON body' } }, { status: 400 });
  }

  const workspaceResolution = await resolveWorkspaceContext(req, {
    workspaceId: body.workspaceId,
    minRole: 'ADMIN',
  });
  if (workspaceResolution.response) return workspaceResolution.response;
  const { context } = workspaceResolution;

  const tier = (body.tier ?? 'tier_2') as CheckoutTier;
  if (!['tier_2', 'unlimited'].includes(tier)) {
    return Response.json({ name: 'invalid-tier', data: { tier } }, { status: 400 });
  }

  const priceId = getPriceIdByTier(tier);
  if (!priceId) {
    return Response.json({ name: 'stripe-price-not-configured', data: { tier } }, { status: 503 });
  }

  try {
    const appOrigin = resolveClientAppOrigin(req);
    const subscription = await getOrCreateByWorkspaceId(context.workspaceId);
    const customerId =
      subscription.stripeCustomerId ??
      (await createStripeCustomer({
        workspaceId: context.workspaceId,
        workspaceName: context.workspaceName,
        currentUserEmail: context.currentUserEmail,
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
      workspaceId: context.workspaceId,
      customerId,
      priceId,
      appOrigin,
    });

    return Response.json({ data: { url } });
  } catch (error) {
    return Response.json(
      { name: 'stripe-error', data: { message: error instanceof Error ? error.message : 'Stripe request failed' } },
      { status: 502 },
    );
  }
}
