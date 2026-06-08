import { apiClient } from '~/common/api/client';

export type SubscriptionTier = 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4' | 'unlimited';

export interface WorkspaceSubscription {
  userId: string;
  tier: SubscriptionTier;
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  stripeCurrentPeriodEnd: string | null;
  subscriptionsEnabled: boolean;
}

export interface CheckoutRequest {
  workspaceId: string;
  tier: Extract<SubscriptionTier, 'tier_2' | 'tier_3' | 'tier_4'>;
}

export interface CheckoutResponse {
  data: { url: string };
}

export interface PortalResponse {
  data: { url: string };
}

export type EntitlementValue = number | 'unlimited';

export interface WorkspaceEntitlements {
  'workspace:max-workspaces': EntitlementValue;
  'board:max-per-workspace': EntitlementValue;
  'board:max-total': EntitlementValue;
  'list:max-per-board': EntitlementValue;
  'card:max-per-board': EntitlementValue;
  'member:max-invited-per-board': EntitlementValue;
  'guest:max-per-board': EntitlementValue;
  'storage:max-bytes': EntitlementValue;
  'ratelimit:read-per-minute': EntitlementValue;
  'ratelimit:write-per-minute': EntitlementValue;
}

export interface WorkspaceUsage {
  boardsPerWorkspace: number;
  boardsTotal: number;
  columnsPerBoard: number;
  cardsPerBoard: number;
  invitedMembersPerBoard: number;
  guestsPerBoard: number;
  storageBytes: number;
}

export interface EntitlementsResponse {
  status: number;
  data: {
    workspaceId: string;
    entitlements: WorkspaceEntitlements;
    usage: WorkspaceUsage;
  };
}

export function getWorkspaceSubscription(workspaceId: string): Promise<{ data: WorkspaceSubscription }> {
  return (apiClient as { get: <T>(url: string) => Promise<T> }).get<{ data: WorkspaceSubscription }>(
    `../subscription?workspaceId=${encodeURIComponent(workspaceId)}`,
  );
}

export function getWorkspaceEntitlements(workspaceId: string): Promise<EntitlementsResponse> {
  return (apiClient as { get: <T>(url: string) => Promise<T> }).get<EntitlementsResponse>(
    `/workspaces/${encodeURIComponent(workspaceId)}/entitlements`,
  );
}

export function createSubscriptionCheckout(input: CheckoutRequest): Promise<CheckoutResponse> {
  return (apiClient as { post: <T>(url: string, data: unknown) => Promise<T> }).post<CheckoutResponse>(
    '../subscription/checkout',
    input,
  );
}

export function createSubscriptionPortal(workspaceId: string): Promise<PortalResponse> {
  return (apiClient as { post: <T>(url: string, data: unknown) => Promise<T> }).post<PortalResponse>(
    '../subscription/portal',
    { workspaceId },
  );
}
