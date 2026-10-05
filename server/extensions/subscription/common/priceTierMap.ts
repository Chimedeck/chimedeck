import { env } from '../../../config/env';
import type { SubscriptionTier } from './types';

const DEFAULT_TIER: SubscriptionTier = 'tier_1';

export function mapStripePriceIdToTier(priceId: string | null | undefined): SubscriptionTier {
  if (!priceId) return DEFAULT_TIER;
  if (priceId === env.STRIPE_PRICE_TIER_2) return 'tier_2';
  if (priceId === env.STRIPE_PRICE_TIER_3) return 'tier_3';
  if (priceId === env.STRIPE_PRICE_TIER_4) return 'tier_4';
  return DEFAULT_TIER;
}
