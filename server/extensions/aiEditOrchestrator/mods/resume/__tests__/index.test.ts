// Unit tests for resume module.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockGetEditRun = vi.fn();
const mockGetEditSteps = vi.fn();

vi.mock('../../persistence', () => ({
  getEditRun: (...args: unknown[]) => mockGetEditRun(...args),
  getEditSteps: (...args: unknown[]) => mockGetEditSteps(...args),
}));

describe('findLastSuccessfulStep', () => {
  it('returns null when no steps succeeded', async () => {
    const { findLastSuccessfulStep } = await import('../../resume');
    const steps = [
      { id: 's1', run_id: 'r1', step_name: 'context_gather', status: 'FAILED', attempt: 3 },
      { id: 's2', run_id: 'r1', step_name: 'file_scope_plan', status: 'PENDING', attempt: 1 },
    ];
    const result = findLastSuccessfulStep(steps as any);
    expect(result).toBeNull();
  });

  it('returns the last successful step name', async () => {
    const { findLastSuccessfulStep } = await import('../../resume');
    const steps = [
      { id: 's1', run_id: 'r1', step_name: 'context_gather', status: 'SUCCEEDED', attempt: 1 },
      { id: 's2', run_id: 'r1', step_name: 'file_scope_plan', status: 'SUCCEEDED', attempt: 1 },
      { id: 's3', run_id: 'r1', step_name: 'files_create', status: 'FAILED', attempt: 3 },
    ];
    const result = findLastSuccessfulStep(steps as any);
    expect(result).toBe('file_scope_plan');
  });
});

describe('getRemainingSteps', () => {
  it('returns all steps when lastSuccessful is null', async () => {
    const { getRemainingSteps } = await import('../../resume');
    const result = getRemainingSteps([], null);
    expect(result).toEqual([
      'context_gather',
      'file_scope_plan',
      'files_create',
      'files_edit',
      'commit',
    ]);
  });

  it('returns steps after last successful', async () => {
    const { getRemainingSteps } = await import('../../resume');
    const result = getRemainingSteps([], 'file_scope_plan');
    expect(result).toEqual(['files_create', 'files_edit', 'commit']);
  });

  it('returns empty when last successful is the final step', async () => {
    const { getRemainingSteps } = await import('../../resume');
    const result = getRemainingSteps([], 'commit');
    expect(result).toEqual([]);
  });
});

describe('canRetryStep', () => {
  it('returns canRetry true for a new step', async () => {
    const { canRetryStep } = await import('../../resume');
    const result = canRetryStep([], 'context_gather');
    expect(result.canRetry).toBe(true);
  });

  it('returns canRetry false for an already-succeeded step', async () => {
    const { canRetryStep } = await import('../../resume');
    const steps = [
      { id: 's1', run_id: 'r1', step_name: 'context_gather', status: 'SUCCEEDED', attempt: 1 },
    ];
    const result = canRetryStep(steps as any, 'context_gather');
    expect(result.canRetry).toBe(false);
  });

  it('returns canRetry false when max retries exhausted', async () => {
    const { canRetryStep } = await import('../../resume');
    const steps = [
      { id: 's1', run_id: 'r1', step_name: 'files_create', status: 'FAILED', attempt: 3 },
    ];
    const result = canRetryStep(steps as any, 'files_create', 3);
    expect(result.canRetry).toBe(false);
  });

  it('returns canRetry true when retries remain', async () => {
    const { canRetryStep } = await import('../../resume');
    const steps = [
      { id: 's1', run_id: 'r1', step_name: 'files_create', status: 'FAILED', attempt: 2 },
    ];
    const result = canRetryStep(steps as any, 'files_create', 3);
    expect(result.canRetry).toBe(true);
  });
});

describe('resumeRun', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when run not found', async () => {
    mockGetEditRun.mockResolvedValue(null);
    const { resumeRun } = await import('../../resume');
    const result = await resumeRun({ runId: 'nonexistent' });
    expect(result.status).toBe(404);
  });

  it('returns 409 for non-FAILED runs', async () => {
    mockGetEditRun.mockResolvedValue({
      id: 'run-1',
      status: 'COMMITTED',
    });
    mockGetEditSteps.mockResolvedValue([]);
    const { resumeRun } = await import('../../resume');
    const result = await resumeRun({ runId: 'run-1' });
    expect(result.status).toBe(409);
    expect(result.name).toBe('cannot-resume-non-failed-run');
  });

  it('returns 409 when max retries exhausted', async () => {
    mockGetEditRun.mockResolvedValue({
      id: 'run-1',
      status: 'FAILED',
    });
    mockGetEditSteps.mockResolvedValue([
      { id: 's1', run_id: 'run-1', step_name: 'context_gather', status: 'SUCCEEDED', attempt: 1 },
      {
        id: 's2',
        run_id: 'run-1',
        step_name: 'file_scope_plan',
        status: 'FAILED',
        attempt: 3,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);
    const { resumeRun } = await import('../../resume');
    const result = await resumeRun({ runId: 'run-1', maxRetries: 3 });
    expect(result.status).toBe(409);
    expect(result.name).toBe('max-retries-exhausted');
  });

  it('returns 200 with remaining steps on successful resume', async () => {
    mockGetEditRun.mockResolvedValue({
      id: 'run-1',
      status: 'FAILED',
    });
    mockGetEditSteps.mockResolvedValue([
      {
        id: 's1',
        run_id: 'run-1',
        step_name: 'context_gather',
        status: 'SUCCEEDED',
        attempt: 1,
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 's2',
        run_id: 'run-1',
        step_name: 'file_scope_plan',
        status: 'FAILED',
        attempt: 1,
        created_at: '2026-01-01T00:01:00.000Z',
      },
    ]);
    const { resumeRun } = await import('../../resume');
    const result = await resumeRun({ runId: 'run-1' });
    expect(result.status).toBe(200);
    if ('data' in result && result.data) {
      expect(result.message).toContain('Resuming from');
    }
  });
});
