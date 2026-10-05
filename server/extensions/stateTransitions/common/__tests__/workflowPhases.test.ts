import { describe, expect, it } from 'bun:test';
import { validateNodePhases } from '../validator';

describe('workflowPhases validation', () => {
  it('accepts valid phases', () => {
    const result = validateNodePhases({
      workflowPhases: ['NEW_DRAFT', 'SYNC_DOCUMENT'],
    });
    expect(result.ok).toBe(true);
  });

  it('accepts empty phases array', () => {
    const result = validateNodePhases({
      workflowPhases: [],
    });
    expect(result.ok).toBe(true);
  });

  it('accepts absent phases (backward-compatible)', () => {
    const result = validateNodePhases({});
    expect(result.ok).toBe(true);
  });

  it('rejects unknown phase values', () => {
    const result = validateNodePhases({
      workflowPhases: ['NEW_DRAFT', 'INVALID_PHASE'],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('unknown workflow phase');
    }
  });

  it('rejects duplicate phases', () => {
    const result = validateNodePhases({
      workflowPhases: ['NEW_DRAFT', 'NEW_DRAFT'],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('duplicate workflow phase');
    }
  });

  it('rejects non-array workflowPhases', () => {
    const result = validateNodePhases({
      workflowPhases: 'NEW_DRAFT',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe('workflowPhases must be an array when provided');
    }
  });

  it('rejects non-string phase entries', () => {
    const result = validateNodePhases({
      workflowPhases: [42],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe('each workflowPhases entry must be a string');
    }
  });

  it('accepts valid phaseConfig', () => {
    const result = validateNodePhases({
      workflowPhases: ['READY_FOR_DEV'],
      phaseConfig: {
        serviceTierOverride: 'premium',
        autoRun: true,
        requiresHumanApproval: false,
      },
    });
    expect(result.ok).toBe(true);
  });

  it('allows null serviceTierOverride in phaseConfig', () => {
    const result = validateNodePhases({
      workflowPhases: ['READY_FOR_DEV'],
      phaseConfig: {
        serviceTierOverride: null,
        autoRun: false,
        requiresHumanApproval: true,
      },
    });
    expect(result.ok).toBe(true);
  });

  it('rejects non-boolean autoRun in phaseConfig', () => {
    const result = validateNodePhases({
      workflowPhases: ['READY_FOR_DEV'],
      phaseConfig: {
        autoRun: 'yes',
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('phaseConfig.autoRun must be a boolean');
    }
  });

  it('rejects non-boolean requiresHumanApproval in phaseConfig', () => {
    const result = validateNodePhases({
      workflowPhases: ['READY_FOR_DEV'],
      phaseConfig: {
        requiresHumanApproval: 1,
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('phaseConfig.requiresHumanApproval must be a boolean');
    }
  });

  it('validates all six known phases pass', () => {
    const result = validateNodePhases({
      workflowPhases: [
        'NEW_DRAFT',
        'REFINED_PENDING_REVIEW',
        'SYNC_DOCUMENT',
        'READY_FOR_DEV',
        'GENERATE_SPRINT',
        'UPDATE_AS_BUILT',
      ],
    });
    expect(result.ok).toBe(true);
  });
});
