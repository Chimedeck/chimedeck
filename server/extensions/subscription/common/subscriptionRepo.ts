import { db } from '../../../common/db';
import { env } from '../../../config/env';
import { serializeWorkspaceSubscription } from './serializer';
import type {
  SubscriptionStatus,
  SubscriptionTier,
  UpsertWorkspaceSubscriptionInput,
  WorkspaceSubscription,
  WorkspaceSubscriptionRow,
} from './types';

const TABLE_NAME = 'workspace_subscriptions';
const DEFAULT_LIMITED_TIER: SubscriptionTier = 'tier_1';
const DEFAULT_UNLIMITED_TIER: SubscriptionTier = 'unlimited';
const processedStripeEventIds = new Set<string>();

function resolveDefaultTier(): SubscriptionTier {
  return env.SUBSCRIPTIONS_DEFAULT_UNLIMITED_TIER ? DEFAULT_UNLIMITED_TIER : DEFAULT_LIMITED_TIER;
}

export async function getByWorkspaceId(workspaceId: string): Promise<WorkspaceSubscription | null> {
  const row = await db(TABLE_NAME).where({ workspace_id: workspaceId }).first<WorkspaceSubscriptionRow>();
  if (!row) return null;
  return serializeWorkspaceSubscription(row);
}

export async function getOrCreateByWorkspaceId(workspaceId: string): Promise<WorkspaceSubscription> {
  const existing = await getByWorkspaceId(workspaceId);
  if (existing) return existing;

  return upsertWorkspaceSubscription({
    workspaceId,
    tier: 'tier_1',
    status: 'active',
  });
}

export async function getByStripeCustomerId(stripeCustomerId: string): Promise<WorkspaceSubscription | null> {
  const row = await db(TABLE_NAME)
    .where({ stripe_customer_id: stripeCustomerId })
    .first<WorkspaceSubscriptionRow>();
  if (!row) return null;
  return serializeWorkspaceSubscription(row);
}

export async function getByStripeSubscriptionId(stripeSubscriptionId: string): Promise<WorkspaceSubscription | null> {
  const row = await db(TABLE_NAME)
    .where({ stripe_subscription_id: stripeSubscriptionId })
    .first<WorkspaceSubscriptionRow>();
  if (!row) return null;
  return serializeWorkspaceSubscription(row);
}

export async function upsertWorkspaceSubscription(
  input: UpsertWorkspaceSubscriptionInput,
): Promise<WorkspaceSubscription> {
  const now = new Date().toISOString();

  const payload = {
    workspace_id: input.workspaceId,
    tier: input.tier,
    status: input.status,
    stripe_customer_id: input.stripeCustomerId ?? null,
    stripe_subscription_id: input.stripeSubscriptionId ?? null,
    stripe_price_id: input.stripePriceId ?? null,
    stripe_current_period_end: input.stripeCurrentPeriodEnd ?? null,
    updated_at: now,
  };

  const existing = await db(TABLE_NAME).where({ workspace_id: input.workspaceId }).first<{ workspace_id: string }>();

  if (existing) {
    const [updatedRow] = (await db(TABLE_NAME)
      .where({ workspace_id: input.workspaceId })
      .update(payload, ['*'])) as WorkspaceSubscriptionRow[];
    if (!updatedRow) {
      throw new Error('workspace-subscription-update-returned-empty');
    }
    return serializeWorkspaceSubscription(updatedRow);
  }

  const [insertedRow] = (await db(TABLE_NAME)
    .insert({
      ...payload,
      created_at: now,
    })
    .returning('*')) as WorkspaceSubscriptionRow[];
  if (!insertedRow) {
    throw new Error('workspace-subscription-insert-returned-empty');
  }

  return serializeWorkspaceSubscription(insertedRow);
}

export async function upsertStripeSubscriptionState({
  workspaceId,
  tier,
  status,
  stripeCustomerId,
  stripeSubscriptionId,
  stripePriceId,
  stripeCurrentPeriodEnd,
}: {
  workspaceId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  stripeCurrentPeriodEnd: string | null;
}): Promise<WorkspaceSubscription> {
  return upsertWorkspaceSubscription({
    workspaceId,
    tier,
    status,
    stripeCustomerId,
    stripeSubscriptionId,
    stripePriceId,
    stripeCurrentPeriodEnd,
  });
}

export function isStripeEventProcessed(eventId: string): boolean {
  return processedStripeEventIds.has(eventId);
}

export function recordStripeEventProcessed(eventId: string): void {
  processedStripeEventIds.add(eventId);
}

export function clearStripeEventProcessingCache(): void {
  processedStripeEventIds.clear();
}

export async function getCurrentTier(workspaceId: string): Promise<SubscriptionTier> {
  const defaultTier = resolveDefaultTier();

  // [context] Master flag hard-bypasses tier enforcement globally.
  if (!env.SUBSCRIPTIONS_ENABLED) return defaultTier;

  const row = await db(TABLE_NAME)
    .where({ workspace_id: workspaceId })
    .first<Pick<WorkspaceSubscriptionRow, 'tier'>>();

  return row?.tier ?? defaultTier;
}
