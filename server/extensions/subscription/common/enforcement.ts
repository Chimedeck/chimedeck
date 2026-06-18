import {
  getByWorkspaceId,
  getOrCreateByWorkspaceId,
  upsertWorkspaceSubscription,
} from './subscriptionRepo';
import type { WorkspaceSubscription } from './types';

const PAST_DUE_GRACE_MS = 10 * 24 * 60 * 60 * 1000;

export type WorkspaceEnforcementMode = 'normal' | 'blocked';

export interface WorkspaceBillingEnforcement {
  workspaceId: string;
  mode: WorkspaceEnforcementMode;
  code: 'subscription-ok' | 'subscription-payment-required';
  message: string;
  upgradeUrl: string;
}

function isHardLockStatus(status: WorkspaceSubscription['status']): boolean {
  return status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired';
}

function isPastDueBeyondGrace(subscription: WorkspaceSubscription): boolean {
  if (subscription.status !== 'past_due') return false;
  if (!subscription.stripeCurrentPeriodEnd) return false;

  const periodEnd = new Date(subscription.stripeCurrentPeriodEnd);
  if (Number.isNaN(periodEnd.valueOf())) return false;

  return Date.now() - periodEnd.valueOf() > PAST_DUE_GRACE_MS;
}

async function downgradePastDueWorkspaceIfNeeded(
  workspaceId: string
): Promise<WorkspaceSubscription> {
  const current = await getOrCreateByWorkspaceId(workspaceId);

  if (!isPastDueBeyondGrace(current)) return current;

  return upsertWorkspaceSubscription({
    workspaceId,
    tier: 'tier_1',
    status: 'active',
    stripeCustomerId: current.stripeCustomerId,
    stripeSubscriptionId: current.stripeSubscriptionId,
    stripePriceId: null,
    stripeCurrentPeriodEnd: null,
  });
}

export async function getWorkspaceBillingEnforcement(
  workspaceId: string
): Promise<WorkspaceBillingEnforcement> {
  const subscription =
    (await getByWorkspaceId(workspaceId)) ?? (await getOrCreateByWorkspaceId(workspaceId));
  const effectiveSubscription = isPastDueBeyondGrace(subscription)
    ? await downgradePastDueWorkspaceIfNeeded(workspaceId)
    : subscription;

  const upgradeUrl = `/workspace/${workspaceId}/billing`;

  if (isHardLockStatus(effectiveSubscription.status)) {
    return {
      workspaceId,
      mode: 'blocked',
      code: 'subscription-payment-required',
      message: 'This workspace has an overdue subscription. Please update billing to continue.',
      upgradeUrl,
    };
  }

  if (effectiveSubscription.status === 'past_due') {
    return {
      workspaceId,
      mode: 'blocked',
      code: 'subscription-payment-required',
      message: 'This workspace subscription is past due. Please complete payment first.',
      upgradeUrl,
    };
  }

  return {
    workspaceId,
    mode: 'normal',
    code: 'subscription-ok',
    message: 'Workspace subscription is in good standing.',
    upgradeUrl,
  };
}
