// Tests for quota enforcer with activity event emission.
// Verifies that exceeded quotas produce activity events.
// [why] Uses dependency injection (quotaEnforcerDeps) instead of mock.module
// to avoid cross-test contamination with tierPolicy/__tests__/index.test.ts.
import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { SprintArtifact } from '../../../types';
import { quotaEnforcerDeps } from '../quotaEnforcer';

const mockEmitSprintGenQuotaExceeded = mock(async () => {});

// Stub resolveTierPolicy via dep injection — avoids mock.module collision
const originalResolveTierPolicy = quotaEnforcerDeps.resolveTierPolicy;
quotaEnforcerDeps.resolveTierPolicy = (input: { tier: string; sprintCount: number }) => {
  const quotas: Record<string, { maxSprints: number | 'unlimited' }> = {
    tier_1: { maxSprints: 1 },
    tier_2: { maxSprints: 3 },
    tier_3: { maxSprints: 6 },
    tier_4: { maxSprints: 'unlimited' as const },
    unlimited: { maxSprints: 'unlimited' as const },
  };
  const quota = quotas[input.tier] ?? { maxSprints: 1 };
  const effectiveCount =
    quota.maxSprints === 'unlimited'
      ? input.sprintCount
      : Math.min(input.sprintCount, quota.maxSprints);
  const truncated: Array<{ sprintNumber: number; reason: string }> = [];
  if (quota.maxSprints !== 'unlimited' && input.sprintCount > (quota.maxSprints)) {
    for (let i = effectiveCount + 1; i <= input.sprintCount; i++) {
      truncated.push({
        sprintNumber: i,
        reason: `Sprint ${i} exceeds tier quota`,
      });
    }
  }
  return {
    allowed: true,
    maxSprints: quota.maxSprints,
    dependencyGraph: false,
    testMatrix: false,
    riskRegister: false,
    truncatedSprints: truncated,
  };
};

// Override activity emitter dep
quotaEnforcerDeps.emitSprintGenQuotaExceeded = mockEmitSprintGenQuotaExceeded;
const makeArtifact = (sprintNumber: number): SprintArtifact => ({
  sprintNumber,
  filePath: `specs/sprints/sprint-${sprintNumber}.md`,
  content: `# Sprint ${sprintNumber}`,
  title: `Sprint ${sprintNumber}`,
  requirements: [],
  dependencies: [],
  acceptanceCriteria: [],
  testScenarios: [],
});

describe('enforceQuotaWithActivity', () => {
  beforeEach(() => {
    mockEmitSprintGenQuotaExceeded.mockClear();
  });

  it('emits quota_exceeded event when sprints are truncated', async () => {
    // Force reimport to pick up the mock
    const { enforceQuotaWithActivity } = await import('../quotaEnforcer');

    const artifacts = [
      makeArtifact(1),
      makeArtifact(2),
      makeArtifact(3),
      makeArtifact(4),
      makeArtifact(5),
    ];

    const result = await enforceQuotaWithActivity({
      artifacts,
      tier: 'tier_1',
      cardId: 'card-1',
      boardId: 'board-1',
      runId: 'run-1',
      actorId: 'user-1',
    });

    expect(result.allowedArtifacts).toHaveLength(1);
    expect(result.skippedSprints).toHaveLength(4);
    expect(mockEmitSprintGenQuotaExceeded).toHaveBeenCalledTimes(1);

    const callArgs = mockEmitSprintGenQuotaExceeded.mock.calls[0]?.[0];
    expect(callArgs.cardId).toBe('card-1');
    expect(callArgs.payload.totalSprints).toBe(5);
    expect(callArgs.payload.allowedSprints).toBe(1);
    expect(callArgs.payload.skippedSprints).toHaveLength(4);
  });

  it('does not emit event when within quota', async () => {
    const { enforceQuotaWithActivity } = await import('../quotaEnforcer');

    const artifacts = [makeArtifact(1)];

    const result = await enforceQuotaWithActivity({
      artifacts,
      tier: 'tier_2',
      cardId: 'card-1',
      boardId: 'board-1',
      runId: 'run-2',
      actorId: 'user-1',
    });

    expect(result.allowedArtifacts).toHaveLength(1);
    expect(result.skippedSprints).toHaveLength(0);
    expect(mockEmitSprintGenQuotaExceeded).not.toHaveBeenCalled();
  });

  it('handles activity emission failure gracefully', async () => {
    mockEmitSprintGenQuotaExceeded.mockRejectedValueOnce(
      new Error('DB connection lost'),
    );

    const { enforceQuotaWithActivity } = await import('../quotaEnforcer');

    const artifacts = [makeArtifact(1), makeArtifact(2)];

    // Should not throw despite activity emission failure
    const result = await enforceQuotaWithActivity({
      artifacts,
      tier: 'tier_1',
      cardId: 'card-1',
      boardId: null,
      runId: 'run-3',
      actorId: 'user-1',
    });

    expect(result.allowedArtifacts).toHaveLength(1);
    expect(result.skippedSprints).toHaveLength(1);
  });
});
