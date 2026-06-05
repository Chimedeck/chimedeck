import type {
  SubscriptionTier,
  WorkspaceSubscription,
  WorkspaceSubscriptionApiResponse,
  WorkspaceSubscriptionRow,
} from './types';

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function serializeWorkspaceSubscription(row: WorkspaceSubscriptionRow): WorkspaceSubscription {
  return {
    workspaceId: row.workspace_id,
    tier: row.tier,
    status: row.status,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripePriceId: row.stripe_price_id,
    stripeCurrentPeriodEnd: row.stripe_current_period_end ? toIsoString(row.stripe_current_period_end) : null,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

export function serializeWorkspaceSubscriptionResponse({
  subscription,
  tier,
  subscriptionsEnabled,
}: {
  subscription: WorkspaceSubscription;
  tier: SubscriptionTier;
  subscriptionsEnabled: boolean;
}): WorkspaceSubscriptionApiResponse {
  return {
    workspaceId: subscription.workspaceId,
    tier,
    status: subscription.status,
    stripeCustomerId: subscription.stripeCustomerId,
    stripeSubscriptionId: subscription.stripeSubscriptionId,
    stripePriceId: subscription.stripePriceId,
    stripeCurrentPeriodEnd: subscription.stripeCurrentPeriodEnd,
    subscriptionsEnabled,
  };
}
