export type SubscriptionTier = 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4' | 'unlimited';

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid';

export interface UserSubscriptionRow {
  user_id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  stripe_current_period_end: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface UserSubscription {
  userId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  stripeCurrentPeriodEnd: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertUserSubscriptionInput {
  userId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  stripeCurrentPeriodEnd?: string | Date | null;
}

// Backward-compat aliases while call sites migrate to user-centric naming.
export type WorkspaceSubscriptionRow = UserSubscriptionRow;
export type WorkspaceSubscription = UserSubscription;
export type UpsertWorkspaceSubscriptionInput = UpsertUserSubscriptionInput;

export type WorkspaceMembershipRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'GUEST';

export interface WorkspaceContext {
  workspaceId: string;
  workspaceName: string;
  currentUserId: string;
  currentUserEmail: string;
  ownerUserId: string;
  ownerUserEmail: string | null;
  role: WorkspaceMembershipRole;
}

export interface WorkspaceSubscriptionApiResponse {
  userId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  stripeCurrentPeriodEnd: string | null;
  subscriptionsEnabled: boolean;
}
