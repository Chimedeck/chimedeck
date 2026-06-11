// Tests for tier gating — verify phase eligibility based on tier + features.
import { describe, it, expect, vi } from 'vitest';
import type { SubscriptionTier } from '../../../../subscription/common/types';
import type { WorkflowPhase } from '../../../../stateTransitions/common/types';

// Mock resolveWorkspaceEntitlements
const mockResolveWorkspaceEntitlements = vi.fn();

vi.mock('../../../../subscription/common/entitlements', () => ({
  resolveWorkspaceEntitlements: mockResolveWorkspaceEntitlements,
}));

const tierWithAgenticWorkflow = (
  tier: SubscriptionTier,
  agenticWorkflow: boolean,
) => ({
  tier,
  features: {
    automations: true,
    webhooks: true,
    plugins: true,
    customFields: true,
    apiTokens: true,
    stateTransitions: true,
    agenticWorkflow,
  },
});

describe('evaluatePhaseTierEligibility', () => {
  it('denies all phases when agenticWorkflow feature is false (personal)', async () => {
    const { evaluatePhaseTierEligibility } = await import('../index');

    mockResolveWorkspaceEntitlements.mockResolvedValueOnce(
      tierWithAgenticWorkflow('tier_1', false),
    );

    const result = await evaluatePhaseTierEligibility({
      workspaceId: 'ws-1',
      phase: 'SYNC_DOCUMENT',
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Business or higher');
  });

  it('denies all phases when agenticWorkflow feature is false (hobby)', async () => {
    const { evaluatePhaseTierEligibility } = await import('../index');

    mockResolveWorkspaceEntitlements.mockResolvedValueOnce(
      tierWithAgenticWorkflow('tier_2', false),
    );

    const result = await evaluatePhaseTierEligibility({
      workspaceId: 'ws-1',
      phase: 'NEW_DRAFT',
    });

    expect(result.allowed).toBe(false);
  });

  it('denies all phases when agenticWorkflow feature is false (pro)', async () => {
    const { evaluatePhaseTierEligibility } = await import('../index');

    mockResolveWorkspaceEntitlements.mockResolvedValueOnce(
      tierWithAgenticWorkflow('tier_3', false),
    );

    const result = await evaluatePhaseTierEligibility({
      workspaceId: 'ws-1',
      phase: 'UPDATE_AS_BUILT',
    });

    expect(result.allowed).toBe(false);
  });

  it('allows phases with no minimum when agenticWorkflow is true', async () => {
    const { evaluatePhaseTierEligibility } = await import('../index');

    mockResolveWorkspaceEntitlements.mockResolvedValueOnce(
      tierWithAgenticWorkflow('tier_2', true),
    );

    // NEW_DRAFT, REFINED_PENDING_REVIEW have no minimum in the config
    const result = await evaluatePhaseTierEligibility({
      workspaceId: 'ws-1',
      phase: 'NEW_DRAFT',
    });

    expect(result.allowed).toBe(true);
  });

  it('requires tier_2 for SYNC_DOCUMENT', async () => {
    const { evaluatePhaseTierEligibility } = await import('../index');

    // tier_1 has agenticWorkflow: true for this test (artificial, but isolated)
    mockResolveWorkspaceEntitlements.mockResolvedValueOnce(
      tierWithAgenticWorkflow('tier_1', true),
    );

    const result = await evaluatePhaseTierEligibility({
      workspaceId: 'ws-1',
      phase: 'SYNC_DOCUMENT',
    });

    expect(result.allowed).toBe(false);
    expect(result.requiredTier).toBe('tier_2');
    expect(result.reason).toContain('SYNC_DOCUMENT');
  });

  it('allows SYNC_DOCUMENT at tier_2 (hobby)', async () => {
    const { evaluatePhaseTierEligibility } = await import('../index');

    mockResolveWorkspaceEntitlements.mockResolvedValueOnce(
      tierWithAgenticWorkflow('tier_2', true),
    );

    const result = await evaluatePhaseTierEligibility({
      workspaceId: 'ws-1',
      phase: 'SYNC_DOCUMENT',
    });

    expect(result.allowed).toBe(true);
    expect(result.requiredTier).toBe('tier_2');
  });

  it('denies GENERATE_SPRINT at tier_2 (hobby)', async () => {
    const { evaluatePhaseTierEligibility } = await import('../index');

    mockResolveWorkspaceEntitlements.mockResolvedValueOnce(
      tierWithAgenticWorkflow('tier_2', true),
    );

    const result = await evaluatePhaseTierEligibility({
      workspaceId: 'ws-1',
      phase: 'GENERATE_SPRINT',
    });

    expect(result.allowed).toBe(false);
    expect(result.requiredTier).toBe('tier_3');
  });

  it('allows GENERATE_SPRINT at tier_3 (pro)', async () => {
    const { evaluatePhaseTierEligibility } = await import('../index');

    mockResolveWorkspaceEntitlements.mockResolvedValueOnce(
      tierWithAgenticWorkflow('tier_3', true),
    );

    const result = await evaluatePhaseTierEligibility({
      workspaceId: 'ws-1',
      phase: 'GENERATE_SPRINT',
    });

    expect(result.allowed).toBe(true);
    expect(result.requiredTier).toBe('tier_3');
  });

  it('requires tier_4 for UPDATE_AS_BUILT', async () => {
    const { evaluatePhaseTierEligibility } = await import('../index');

    mockResolveWorkspaceEntitlements.mockResolvedValueOnce(
      tierWithAgenticWorkflow('tier_3', true),
    );

    const result = await evaluatePhaseTierEligibility({
      workspaceId: 'ws-1',
      phase: 'UPDATE_AS_BUILT',
    });

    expect(result.allowed).toBe(false);
    expect(result.requiredTier).toBe('tier_4');
  });

  it('allows UPDATE_AS_BUILT at tier_4 (business)', async () => {
    const { evaluatePhaseTierEligibility } = await import('../index');

    mockResolveWorkspaceEntitlements.mockResolvedValueOnce(
      tierWithAgenticWorkflow('tier_4', true),
    );

    const result = await evaluatePhaseTierEligibility({
      workspaceId: 'ws-1',
      phase: 'UPDATE_AS_BUILT',
    });

    expect(result.allowed).toBe(true);
    expect(result.requiredTier).toBe('tier_4');
  });

  it('allows all phases at enterprise tier', async () => {
    const { evaluatePhaseTierEligibility } = await import('../index');

    // [why] mockResolvedValue (not Once) — called 4 times in the loop below
    mockResolveWorkspaceEntitlements.mockResolvedValue(
      tierWithAgenticWorkflow('unlimited', true),
    );

    const phases: WorkflowPhase[] = [
      'NEW_DRAFT',
      'SYNC_DOCUMENT',
      'GENERATE_SPRINT',
      'UPDATE_AS_BUILT',
    ];

    for (const phase of phases) {
      const result = await evaluatePhaseTierEligibility({
        workspaceId: 'ws-1',
        phase,
      });
      expect(result.allowed).toBe(true);
    }
  });

  it('includes upgrade hint in denial response', async () => {
    const { evaluatePhaseTierEligibility } = await import('../index');

    mockResolveWorkspaceEntitlements.mockResolvedValueOnce(
      tierWithAgenticWorkflow('tier_1', true),
    );

    const result = await evaluatePhaseTierEligibility({
      workspaceId: 'ws-1',
      phase: 'SYNC_DOCUMENT',
    });

    expect(result.allowed).toBe(false);
    expect(result.upgradeHint).toBeDefined();
    expect(result.upgradeHint).toContain('Upgrade');
  });
});
