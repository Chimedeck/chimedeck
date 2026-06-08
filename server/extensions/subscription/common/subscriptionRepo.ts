import { db } from '../../../common/db';
import { env } from '../../../config/env';
import { mapStripePriceIdToTier } from './priceTierMap';
import { serializeWorkspaceSubscription } from './serializer';
import type {
  SubscriptionStatus,
  SubscriptionTier,
  UpsertUserSubscriptionInput,
  WorkspaceSubscription,
  WorkspaceSubscriptionRow,
} from './types';

const TABLE_NAME = 'user_subscriptions';
const DEFAULT_LIMITED_TIER: SubscriptionTier = 'tier_1';
const DEFAULT_UNLIMITED_TIER: SubscriptionTier = 'unlimited';
const processedStripeEventIds = new Set<string>();

function resolveDefaultTier(): SubscriptionTier {
  return env.SUBSCRIPTIONS_DEFAULT_UNLIMITED_TIER ? DEFAULT_UNLIMITED_TIER : DEFAULT_LIMITED_TIER;
}

async function resolveWorkspaceOwnerUserId(workspaceId: string): Promise<string | null> {
  try {
    const workspace = await db('workspaces')
      .where({ id: workspaceId })
      .select('owner_id')
      .first<{ owner_id: string }>();
    return workspace?.owner_id ?? null;
  } catch {
    return null;
  }
}

export async function getByUserId(userId: string): Promise<WorkspaceSubscription | null> {
  const row = await db(TABLE_NAME).where({ user_id: userId }).first<WorkspaceSubscriptionRow>();
  if (!row) return null;
  return serializeWorkspaceSubscription(row);
}

export async function getOrCreateByUserId(userId: string): Promise<WorkspaceSubscription> {
  const existing = await getByUserId(userId);
  if (existing) return existing;

  return upsertUserSubscription({
    userId,
    tier: 'tier_1',
    status: 'active',
  });
}

export async function getByWorkspaceId(workspaceId: string): Promise<WorkspaceSubscription | null> {
  const ownerUserId = await resolveWorkspaceOwnerUserId(workspaceId);
  return getByUserId(ownerUserId ?? workspaceId);
}

export async function getOrCreateByWorkspaceId(workspaceId: string): Promise<WorkspaceSubscription> {
  const ownerUserId = await resolveWorkspaceOwnerUserId(workspaceId);
  return getOrCreateByUserId(ownerUserId ?? workspaceId);
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

export async function upsertUserSubscription(
  input: UpsertUserSubscriptionInput,
): Promise<WorkspaceSubscription> {
  const now = new Date().toISOString();

  const payload = {
    user_id: input.userId,
    tier: input.tier,
    status: input.status,
    stripe_customer_id: input.stripeCustomerId ?? null,
    stripe_subscription_id: input.stripeSubscriptionId ?? null,
    stripe_price_id: input.stripePriceId ?? null,
    stripe_current_period_end: input.stripeCurrentPeriodEnd ?? null,
    updated_at: now,
  };

  const existing = await db(TABLE_NAME).where({ user_id: input.userId }).first<{ user_id: string }>();

  if (existing) {
    const [updatedRow] = (await db(TABLE_NAME)
      .where({ user_id: input.userId })
      .update(payload, ['*'])) as WorkspaceSubscriptionRow[];
    if (!updatedRow) {
      throw new Error('user-subscription-update-returned-empty');
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
    throw new Error('user-subscription-insert-returned-empty');
  }

  return serializeWorkspaceSubscription(insertedRow);
}

export async function upsertWorkspaceSubscription(
  input: { workspaceId: string } & Omit<UpsertUserSubscriptionInput, 'userId'>,
): Promise<WorkspaceSubscription> {
  const ownerUserId = await resolveWorkspaceOwnerUserId(input.workspaceId);
  return upsertUserSubscription({
    userId: ownerUserId ?? input.workspaceId,
    tier: input.tier,
    status: input.status,
    stripeCustomerId: input.stripeCustomerId,
    stripeSubscriptionId: input.stripeSubscriptionId,
    stripePriceId: input.stripePriceId,
    stripeCurrentPeriodEnd: input.stripeCurrentPeriodEnd,
  });
}

export async function upsertStripeSubscriptionState({
  userId,
  tier,
  status,
  stripeCustomerId,
  stripeSubscriptionId,
  stripePriceId,
  stripeCurrentPeriodEnd,
}: {
  userId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  stripeCurrentPeriodEnd: string | null;
}): Promise<WorkspaceSubscription> {
  return upsertUserSubscription({
    userId,
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

export async function getCurrentTierForUser(userId: string): Promise<SubscriptionTier> {
  const defaultTier = resolveDefaultTier();

  if (!env.SUBSCRIPTIONS_ENABLED) return defaultTier;

  const row = await db(TABLE_NAME)
    .where({ user_id: userId })
    .first<Pick<WorkspaceSubscriptionRow, 'tier' | 'stripe_price_id'>>();

  if (!row?.tier) return defaultTier;

  if (row.tier === 'unlimited' && row.stripe_price_id) {
    const mappedTier = mapStripePriceIdToTier(row.stripe_price_id);
    if (mappedTier !== 'tier_1') return mappedTier;
  }

  return row.tier;
}

export async function getCurrentTier(workspaceId: string): Promise<SubscriptionTier> {
  const ownerUserId = await resolveWorkspaceOwnerUserId(workspaceId);
  return getCurrentTierForUser(ownerUserId ?? workspaceId);
}
