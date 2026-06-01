import { env } from '../../../config/env';
import { getByWorkspaceId } from '../common/subscriptionRepo';
import { resolveWorkspaceContext } from '../common/workspaceResolver';

async function createStripePortalSession({
  customerId,
  workspaceId,
}: {
  customerId: string;
  workspaceId: string;
}): Promise<string> {
  const body = new URLSearchParams();
  body.set('customer', customerId);
  body.set('return_url', `${env.APP_URL}/workspace/${workspaceId}/billing`);

  const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const payload = (await response.json()) as { url?: string; error?: { message?: string } };
  if (!response.ok || !payload.url) {
    throw new Error(payload.error?.message ?? 'stripe-portal-session-create-failed');
  }

  return payload.url;
}

export async function handleCreatePortal(req: Request): Promise<Response> {
  if (!env.SUBSCRIPTIONS_ENABLED) {
    return Response.json({ name: 'subscriptions-disabled' }, { status: 503 });
  }

  if (!env.STRIPE_SECRET_KEY) {
    return Response.json({ name: 'stripe-not-configured' }, { status: 503 });
  }

  let body: { workspaceId?: string } = {};
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

  const subscription = await getByWorkspaceId(context.workspaceId);
  if (!subscription?.stripeCustomerId) {
    return Response.json(
      { name: 'stripe-customer-not-found', data: { workspaceId: context.workspaceId } },
      { status: 409 },
    );
  }

  try {
    const url = await createStripePortalSession({
      customerId: subscription.stripeCustomerId,
      workspaceId: context.workspaceId,
    });
    return Response.json({ data: { url } });
  } catch (error) {
    return Response.json(
      { name: 'stripe-error', data: { message: error instanceof Error ? error.message : 'Stripe request failed' } },
      { status: 502 },
    );
  }
}
