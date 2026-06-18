import {
  getByUserId,
  getByStripeCustomerId,
  getByStripeSubscriptionId,
  isStripeEventProcessed,
  recordStripeEventProcessed,
  upsertStripeSubscriptionState,
} from './subscriptionRepo';
import { db } from '../../../common/db';
import { mapStripePriceIdToTier } from './priceTierMap';
import type { SubscriptionStatus, SubscriptionTier } from './types';

interface StripeSubscriptionObject {
  id: string;
  customer: string;
  status?: string;
  current_period_end?: number;
  metadata?: Record<string, unknown>;
  items?: {
    data?: Array<{
      price?: {
        id?: string | null;
      } | null;
    }>;
  } | null;
}

interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: unknown;
  };
}

export interface SyncFromStripeResult {
  processed: boolean;
  idempotent: boolean;
  ignored: boolean;
  userId?: string;
  tier?: SubscriptionTier;
}

const SUPPORTED_EVENT_TYPES = new Set<string>([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

function isStripeSubscriptionObject(value: unknown): value is StripeSubscriptionObject {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StripeSubscriptionObject>;
  return typeof candidate.id === 'string' && typeof candidate.customer === 'string';
}

function mapStripeStatusToInternal(
  status: string | undefined,
  eventType: string
): SubscriptionStatus {
  if (eventType === 'customer.subscription.deleted') return 'canceled';

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

function toPeriodEndIsoString(
  periodEndUnixSeconds: number | undefined,
  eventType: string
): string | null {
  if (eventType === 'customer.subscription.deleted') return null;
  if (typeof periodEndUnixSeconds !== 'number') return null;
  return new Date(periodEndUnixSeconds * 1000).toISOString();
}

function getUserIdFromMetadata(metadata: Record<string, unknown> | undefined): string | null {
  const userId = metadata?.userId ?? metadata?.user_id;
  return typeof userId === 'string' && userId.trim() ? userId : null;
}

async function getUserIdFromWorkspaceMetadata(
  metadata: Record<string, unknown> | undefined
): Promise<string | null> {
  const workspaceId = metadata?.workspaceId ?? metadata?.workspace_id;
  if (typeof workspaceId !== 'string' || !workspaceId.trim()) return null;

  const workspace = await db('workspaces')
    .where({ id: workspaceId })
    .select('owner_id')
    .first<{ owner_id: string }>();
  return workspace?.owner_id ?? null;
}

function getPriceId(subscription: StripeSubscriptionObject): string | null {
  return subscription.items?.data?.[0]?.price?.id ?? null;
}

async function resolveUserId(subscription: StripeSubscriptionObject): Promise<string | null> {
  const metadataUserId = getUserIdFromMetadata(subscription.metadata);
  if (metadataUserId) return metadataUserId;

  const metadataWorkspaceOwner = await getUserIdFromWorkspaceMetadata(subscription.metadata);
  if (metadataWorkspaceOwner) return metadataWorkspaceOwner;

  const bySubscription = await getByStripeSubscriptionId(subscription.id);
  if (bySubscription) return bySubscription.userId;

  const byCustomer = await getByStripeCustomerId(subscription.customer);
  if (byCustomer) return byCustomer.userId;

  return null;
}

function hasSameProjection({
  currentTier,
  nextTier,
  currentStatus,
  nextStatus,
  currentStripePriceId,
  nextStripePriceId,
  currentStripeSubscriptionId,
  nextStripeSubscriptionId,
  currentStripeCustomerId,
  nextStripeCustomerId,
  currentStripeCurrentPeriodEnd,
  nextStripeCurrentPeriodEnd,
}: {
  currentTier: SubscriptionTier;
  nextTier: SubscriptionTier;
  currentStatus: SubscriptionStatus;
  nextStatus: SubscriptionStatus;
  currentStripePriceId: string | null;
  nextStripePriceId: string | null;
  currentStripeSubscriptionId: string | null;
  nextStripeSubscriptionId: string | null;
  currentStripeCustomerId: string | null;
  nextStripeCustomerId: string | null;
  currentStripeCurrentPeriodEnd: string | null;
  nextStripeCurrentPeriodEnd: string | null;
}): boolean {
  return (
    currentTier === nextTier &&
    currentStatus === nextStatus &&
    currentStripePriceId === nextStripePriceId &&
    currentStripeSubscriptionId === nextStripeSubscriptionId &&
    currentStripeCustomerId === nextStripeCustomerId &&
    currentStripeCurrentPeriodEnd === nextStripeCurrentPeriodEnd
  );
}

export async function syncSubscriptionFromStripeEvent({
  event,
}: {
  event: StripeEvent;
}): Promise<SyncFromStripeResult> {
  if (isStripeEventProcessed(event.id)) {
    return { processed: false, idempotent: true, ignored: false };
  }

  if (!SUPPORTED_EVENT_TYPES.has(event.type)) {
    recordStripeEventProcessed(event.id);
    return { processed: false, idempotent: false, ignored: true };
  }

  if (!isStripeSubscriptionObject(event.data.object)) {
    throw new Error('stripe-event-object-invalid');
  }

  const subscription = event.data.object;
  const userId = await resolveUserId(subscription);
  if (!userId) {
    throw new Error('user-id-not-found-for-stripe-subscription');
  }

  const stripePriceId = getPriceId(subscription);
  const tier =
    event.type === 'customer.subscription.deleted'
      ? 'tier_1'
      : mapStripePriceIdToTier(stripePriceId);
  const status = mapStripeStatusToInternal(subscription.status, event.type);
  const stripeCurrentPeriodEnd = toPeriodEndIsoString(subscription.current_period_end, event.type);

  const current = await getByUserId(userId);
  if (
    current &&
    hasSameProjection({
      currentTier: current.tier,
      nextTier: tier,
      currentStatus: current.status,
      nextStatus: status,
      currentStripePriceId: current.stripePriceId,
      nextStripePriceId: stripePriceId,
      currentStripeSubscriptionId: current.stripeSubscriptionId,
      nextStripeSubscriptionId: subscription.id,
      currentStripeCustomerId: current.stripeCustomerId,
      nextStripeCustomerId: subscription.customer,
      currentStripeCurrentPeriodEnd: current.stripeCurrentPeriodEnd,
      nextStripeCurrentPeriodEnd: stripeCurrentPeriodEnd,
    })
  ) {
    recordStripeEventProcessed(event.id);
    return { processed: false, idempotent: true, ignored: false, userId, tier };
  }

  await upsertStripeSubscriptionState({
    userId,
    tier,
    status,
    stripeCustomerId: subscription.customer,
    stripeSubscriptionId: subscription.id,
    stripePriceId,
    stripeCurrentPeriodEnd,
  });

  recordStripeEventProcessed(event.id);

  return {
    processed: true,
    idempotent: false,
    ignored: false,
    userId,
    tier,
  };
}
