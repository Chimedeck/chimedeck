// Sprint 176 — Tier-aware quota enforcer for sprint generation.
// [why] Truncates sprint counts to tier maximums, flags over-limit sprints
// with SKIPPED reason, and emits quota_exceeded activity events.
import { resolveTierPolicy } from './index';
import { emitSprintGenQuotaExceeded } from '../activities';
import type { SprintArtifact, TierPolicyInput } from '../../types';

export const quotaEnforcerDeps = {
  resolveTierPolicy,
  emitSprintGenQuotaExceeded,
};

/**
 * Apply tier quota to a list of sprint artifacts.
 * Returns only the artifacts within tier limits and a list of skipped sprint numbers.
 */
export function enforceQuota({ artifacts, tier }: { artifacts: SprintArtifact[]; tier: string }): {
  allowedArtifacts: SprintArtifact[];
  skippedSprints: Array<{ sprintNumber: number; reason: string }>;
} {
  const policy = quotaEnforcerDeps.resolveTierPolicy({
    tier,
    sprintCount: artifacts.length,
  });

  const maxSprints = policy.maxSprints;
  const effectiveCount =
    maxSprints === 'unlimited' ? artifacts.length : Math.min(artifacts.length, maxSprints);

  // Sort artifacts by sprint number to ensure consistent truncation order
  const sorted = [...artifacts].sort((a, b) => a.sprintNumber - b.sprintNumber);

  const allowedArtifacts = sorted.slice(0, effectiveCount);
  const skippedSprints: Array<{ sprintNumber: number; reason: string }> = [];

  const truncated = policy.truncatedSprints;
  for (let i = 0; i < truncated.length; i++) {
    skippedSprints.push({
      sprintNumber: truncated[i]!.sprintNumber,
      reason: truncated[i]!.reason,
    });
  }

  return { allowedArtifacts, skippedSprints };
}

/**
 * Enforce quota and emit activity events for exceeded sprints.
 * Returns the filtered artifacts and skipped sprint info.
 */
export async function enforceQuotaWithActivity({
  artifacts,
  tier,
  cardId,
  boardId,
  runId,
  actorId,
}: {
  artifacts: SprintArtifact[];
  tier: string;
  cardId: string;
  boardId: string | null;
  runId: string;
  actorId: string;
}): Promise<{
  allowedArtifacts: SprintArtifact[];
  skippedSprints: Array<{ sprintNumber: number; reason: string }>;
}> {
  const result = enforceQuota({ artifacts, tier });

  if (result.skippedSprints.length > 0) {
    try {
      await quotaEnforcerDeps.emitSprintGenQuotaExceeded({
        cardId,
        boardId,
        runId,
        actorId,
        payload: {
          tier,
          totalSprints: artifacts.length,
          allowedSprints: result.allowedArtifacts.length,
          skippedSprints: result.skippedSprints.map((s) => ({
            sprintNumber: s.sprintNumber,
            reason: s.reason,
          })),
        },
      });
    } catch {
      // Fire-and-forget
    }
  }

  return result;
}
