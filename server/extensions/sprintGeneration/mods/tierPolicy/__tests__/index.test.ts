// Tests for tier policy and quota enforcer — verify sprint count caps,
// feature enablement, and truncation behaviour per subscription tier.
import { describe, it, expect } from 'bun:test';
import type { SprintArtifact } from '../../../types';

describe('resolveTierPolicy', () => {
  it('limits tier_1 to 1 sprint', async () => {
    const { resolveTierPolicy } = await import('../index');

    const result = resolveTierPolicy({ tier: 'tier_1', sprintCount: 5 });

    expect(result.allowed).toBe(true);
    expect(result.maxSprints).toBe(1);
    expect(result.dependencyGraph).toBe(false);
    expect(result.testMatrix).toBe(false);
    expect(result.riskRegister).toBe(false);
    expect(result.requiresHumanApproval).toBe(true);
    expect(result.truncatedSprints).toHaveLength(4);
  });

  it('allows up to 3 sprints on tier_2', async () => {
    const { resolveTierPolicy } = await import('../index');

    const result = resolveTierPolicy({ tier: 'tier_2', sprintCount: 2 });

    expect(result.allowed).toBe(true);
    expect(result.maxSprints).toBe(3);
    expect(result.requiresHumanApproval).toBe(true);
    expect(result.truncatedSprints).toHaveLength(0);
  });

  it('truncates beyond 3 sprints on tier_2', async () => {
    const { resolveTierPolicy } = await import('../index');

    const result = resolveTierPolicy({ tier: 'tier_2', sprintCount: 5 });

    expect(result.maxSprints).toBe(3);
    expect(result.truncatedSprints).toHaveLength(2);
    expect(result.truncatedSprints[0]!.sprintNumber).toBe(4);
    expect(result.truncatedSprints[0]!.reason).toContain('tier_2');
  });

  it('allows up to 6 sprints on tier_3', async () => {
    const { resolveTierPolicy } = await import('../index');

    const result = resolveTierPolicy({ tier: 'tier_3', sprintCount: 6 });

    expect(result.maxSprints).toBe(6);
    expect(result.dependencyGraph).toBe(true);
    expect(result.testMatrix).toBe(false);
    expect(result.riskRegister).toBe(false);
    expect(result.requiresHumanApproval).toBe(false);
    expect(result.truncatedSprints).toHaveLength(0);
  });

  it('adds upgrade hint when truncated', async () => {
    const { resolveTierPolicy } = await import('../index');

    const result = resolveTierPolicy({ tier: 'tier_3', sprintCount: 10 });

    expect(result.truncatedSprints).toHaveLength(4);
    expect(result.upgradeHint).toBeDefined();
    expect(result.upgradeHint).toContain('Upgrade');
  });

  it('allows unlimited sprints on tier_4 (business)', async () => {
    const { resolveTierPolicy } = await import('../index');

    const result = resolveTierPolicy({ tier: 'tier_4', sprintCount: 20 });

    expect(result.maxSprints).toBe('unlimited');
    expect(result.dependencyGraph).toBe(true);
    expect(result.testMatrix).toBe(true);
    expect(result.riskRegister).toBe(true);
    expect(result.requiresHumanApproval).toBe(false);
    expect(result.truncatedSprints).toHaveLength(0);
  });

  it('allows unlimited sprints on enterprise tier', async () => {
    const { resolveTierPolicy } = await import('../index');

    const result = resolveTierPolicy({ tier: 'unlimited', sprintCount: 50 });

    expect(result.maxSprints).toBe('unlimited');
    expect(result.dependencyGraph).toBe(true);
    expect(result.testMatrix).toBe(true);
    expect(result.riskRegister).toBe(true);
    expect(result.requiresHumanApproval).toBe(false);
    expect(result.truncatedSprints).toHaveLength(0);
  });

  it('falls back to tier_1 for unknown tiers', async () => {
    const { resolveTierPolicy } = await import('../index');

    // @ts-expect-error — testing unknown tier
    const result = resolveTierPolicy({ tier: 'unknown_tier', sprintCount: 5 });

    expect(result.maxSprints).toBe(1);
    expect(result.dependencyGraph).toBe(false);
    expect(result.testMatrix).toBe(false);
    expect(result.riskRegister).toBe(false);
    expect(result.requiresHumanApproval).toBe(true);
  });

  it('provides human-readable tier display names', async () => {
    const { tierDisplayName } = await import('../index');

    expect(tierDisplayName('tier_1')).toBe('Personal');
    expect(tierDisplayName('tier_2')).toBe('Hobby');
    expect(tierDisplayName('tier_3')).toBe('Pro');
    expect(tierDisplayName('tier_4')).toBe('Business');
    expect(tierDisplayName('unlimited')).toBe('Enterprise');
    expect(tierDisplayName('unknown')).toBe('unknown');
  });
});

describe('enforceQuota', () => {
  const makeArtifact = (sprintNumber: number): SprintArtifact => ({
    sprintNumber,
    filePath: `specs/sprints/sprint-${sprintNumber}.md`,
    content: `# Sprint ${sprintNumber}\n\nContent for sprint ${sprintNumber}`,
    title: `Sprint ${sprintNumber}`,
    requirements: [`req-${sprintNumber}`],
    dependencies: [],
    acceptanceCriteria: [`AC for sprint ${sprintNumber}`],
    testScenarios: ['Tests for sprint ' + sprintNumber],
  });

  it('returns all artifacts when within tier limit', async () => {
    const { enforceQuota } = await import('../quotaEnforcer');

    const artifacts = [makeArtifact(1), makeArtifact(2)];

    const result = enforceQuota({ artifacts, tier: 'tier_2' });

    expect(result.allowedArtifacts).toHaveLength(2);
    expect(result.skippedSprints).toHaveLength(0);
  });

  it('truncates artifacts exceeding tier cap', async () => {
    const { enforceQuota } = await import('../quotaEnforcer');

    const artifacts = [makeArtifact(1), makeArtifact(2), makeArtifact(3)];

    const result = enforceQuota({ artifacts, tier: 'tier_1' });

    expect(result.allowedArtifacts).toHaveLength(1);
    expect(result.allowedArtifacts[0]!.sprintNumber).toBe(1);
    expect(result.skippedSprints).toHaveLength(2);
  });

  it('preserves sprint number order in truncated artifacts', async () => {
    const { enforceQuota } = await import('../quotaEnforcer');

    // Out-of-order artifacts
    const artifacts = [makeArtifact(3), makeArtifact(1), makeArtifact(2)];

    const result = enforceQuota({ artifacts, tier: 'tier_1' });

    expect(result.allowedArtifacts).toHaveLength(1);
    expect(result.allowedArtifacts[0]!.sprintNumber).toBe(1);
  });

  it('allows all artifacts on unlimited tier', async () => {
    const { enforceQuota } = await import('../quotaEnforcer');

    const artifacts = Array.from({ length: 15 }, (_, i) => makeArtifact(i + 1));

    const result = enforceQuota({ artifacts, tier: 'tier_4' });

    expect(result.allowedArtifacts).toHaveLength(15);
    expect(result.skippedSprints).toHaveLength(0);
  });
});
