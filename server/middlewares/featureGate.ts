// Feature-gate middleware.
// Enforces tier-based feature access. Returns a 402 Payment Required response
// when the workspace's subscription tier does not include the requested feature.
//
// Pass-throughs (returns null):
// - SUBSCRIPTIONS_ENABLED is false (master kill switch)
// - workspaceId is undefined (workspace context could not be resolved)
// - Route is not in the FEATURE_GATES map (ungated routes are always allowed)
// - Workspace tier includes the required feature

import { env } from '../config/env';
import { FEATURE_GATES, type GateRule } from '../config/feature-gates';
import {
  SUBSCRIPTION_TIERS,
  TIER_ORDER,
  type BooleanFeatureKey,
  type CanonicalTierId,
} from '../config/subscription-tiers';
import { resolveWorkspaceEntitlements } from '../extensions/subscription/common/entitlements';
import type { SubscriptionTier } from '../extensions/subscription/common/types';

// Map from stored subscription tier IDs to their display/canonical name.
const TIER_DISPLAY: Record<SubscriptionTier, CanonicalTierId> = {
  tier_1: 'tier_1',
  tier_2: 'tier_2',
  unlimited: 'unlimited',
};

/**
 * Normalize a stored SubscriptionTier to a TIER_ORDER index.
 */
function tierIndex(tier: SubscriptionTier): number {
  const canonical = TIER_DISPLAY[tier];
  return TIER_ORDER.indexOf(canonical as CanonicalTierId);
}

/**
 * Find the cheapest tier (lowest TIER_ORDER index) whose feature map has the given feature enabled.
 * Returns the tier ID or 'unlimited' if only the top tier enables it.
 */
export function minimumTierFor(feature: BooleanFeatureKey): CanonicalTierId {
  const tierNameMap: Record<CanonicalTierId, string> = {
    tier_1: 'free',
    tier_2: 'pro',
    unlimited: 'enterprise',
  };

  for (const tierId of TIER_ORDER) {
    const tierName = tierNameMap[tierId];
    const quotas = SUBSCRIPTION_TIERS[tierName];
    if (quotas?.features[feature]) return tierId;
  }

  // [context] Should not happen if tiers are configured correctly; enterprise always enables all.
  return 'unlimited';
}

/**
 * Match the first gate rule that applies to the given method + pathname.
 *
 * Path matching uses prefix comparison after expanding ':param' wildcards:
 * each ':param' segment matches exactly one non-slash path segment.
 * The rule's prefix must be a complete prefix of the pathname (segment boundary aware).
 */
export function matchGate(
  method: string,
  pathname: string,
  gates: GateRule[],
): GateRule | null {
  for (const rule of gates) {
    const methodMatches =
      rule.methods.includes('*') || rule.methods.includes(method as GateRule['methods'][number]);
    if (!methodMatches) continue;

    if (ruleMatchesPath(rule.pathPrefix, pathname)) return rule;
  }
  return null;
}

/**
 * Check whether a path prefix (with optional ':param' wildcards) matches a concrete pathname.
 * The prefix must cover whole path segments — a prefix ending without a trailing '/' or the
 * exact end must coincide with a segment boundary in the pathname.
 */
function ruleMatchesPath(prefix: string, pathname: string): boolean {
  const prefixParts = prefix.split('/');
  const pathParts = pathname.split('/');

  // The prefix must not be longer than the actual path.
  if (prefixParts.length > pathParts.length) return false;

  for (let i = 0; i < prefixParts.length; i++) {
    const p = prefixParts[i];
    const q = pathParts[i];

    if (p.startsWith(':')) {
      // Wildcard segment — matches any single non-empty segment.
      if (!q || q === '') return false;
    } else if (p !== q) {
      // Literal prefix matching: allow partial match on the last prefix segment
      // (e.g. prefix '/api/v1/boards/:boardId/automation-' matches
      // '/api/v1/boards/abc/automation-runs').
      if (i === prefixParts.length - 1 && q.startsWith(p)) return true;
      return false;
    }
  }

  return true;
}

/**
 * Feature-gate middleware entry point.
 *
 * Call after authentication (so userId is known) and before route dispatch.
 * Returns null to allow the request through, or a 402 Response to block it.
 */
export async function applyFeatureGate(
  req: Request,
  workspaceId: string | undefined,
): Promise<Response | null> {
  // Pass-through: master kill switch or no workspace context available.
  if (!env.SUBSCRIPTIONS_ENABLED || !workspaceId) return null;

  const { pathname } = new URL(req.url);
  const rule = matchGate(req.method, pathname, FEATURE_GATES);

  // Ungated route — always allowed.
  if (!rule) return null;

  const { tier, features } = await resolveWorkspaceEntitlements(workspaceId);

  // Workspace tier includes the required feature — allow.
  if (features[rule.feature]) return null;

  const requiredTier = minimumTierFor(rule.feature);

  return Response.json(
    {
      error: {
        code: 'feature-not-in-plan',
        message: `Your plan does not include ${rule.feature}.`,
        data: {
          feature: rule.feature,
          currentTier: tier,
          requiredTier,
          upgradeUrl: `/workspace/${workspaceId}/billing`,
        },
      },
    },
    { status: 402 },
  );
}
