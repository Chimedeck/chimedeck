// Reusable limit calculation helpers.
// Handles quota math: checking overages, computing remaining, dealing with unlimited sentinels.

import type { QuotaValue } from '../config/subscription-tiers';

// Sentinel value for truly unlimited quotas
export const UNLIMITED_QUOTA = 'unlimited';

/**
 * Check if a quota value represents unlimited capacity.
 */
export function isUnlimited(quota: QuotaValue): boolean {
  return quota === UNLIMITED_QUOTA;
}

/**
 * Check if usage exceeds quota.
 * - If quota is unlimited, always returns false.
 * - If usage >= quota, returns true.
 */
export function exceeds(usage: number, quota: QuotaValue): boolean {
  if (isUnlimited(quota)) return false;
  return usage >= (quota as number);
}

/**
 * Get remaining capacity before hitting quota.
 * - If quota is unlimited, returns number.MAX_SAFE_INTEGER.
 * - If usage >= quota, returns 0.
 * - Otherwise, returns (quota - usage).
 */
export function remaining(usage: number, quota: QuotaValue): number {
  if (isUnlimited(quota)) return Number.MAX_SAFE_INTEGER;
  const diff = (quota as number) - usage;
  return Math.max(0, diff);
}

/**
 * Validate that usage does not exceed quota.
 * Returns { valid: true } on pass, { valid: false, remaining: number } on overage.
 */
export function validate(
  usage: number,
  quota: QuotaValue
): { valid: true } | { valid: false; remaining: number; quota: number } {
  if (isUnlimited(quota)) {
    return { valid: true };
  }
  if (usage >= (quota as number)) {
    return { valid: false, remaining: 0, quota: quota as number };
  }
  return { valid: true };
}

/**
 * Get percentage of quota consumed.
 * - If unlimited, returns 0.
 * - Otherwise, returns (usage / quota * 100), clamped to [0, 100].
 */
export function percentageUsed(usage: number, quota: QuotaValue): number {
  if (isUnlimited(quota)) return 0;
  const pct = (usage / (quota as number)) * 100;
  return Math.min(100, Math.max(0, pct));
}
