// Unit tests for AI Edit Orchestrator persistence layer.
import { describe, it, expect, beforeEach, vi } from 'vitest';

// [why] Mock the db module BEFORE any imports to prevent real DB connection.
const mockDbChain: Record<string, (...args: unknown[]) => unknown> = {};
mockDbChain.insert = vi.fn().mockReturnValue(undefined);
mockDbChain.where = vi.fn().mockReturnValue(mockDbChain);
mockDbChain.orderBy = vi.fn().mockReturnValue(mockDbChain);
mockDbChain.first = vi.fn();
mockDbChain.update = vi.fn().mockResolvedValue(1);

vi.mock('../../../../common/db', () => ({
  db: vi.fn((_table: string) => mockDbChain),
}));

vi.mock('../../../../../config/env', () => ({
  env: {
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    JWT_PRIVATE_KEY: 'test',
    JWT_PUBLIC_KEY: 'test',
  },
}));

const mockValidateTransition = vi.fn();
const mockAdvanceState = vi.fn();

vi.mock('../stateMachine', () => ({
  validateTransition: (...args: unknown[]) => mockValidateTransition(...args),
  advanceState: (...args: unknown[]) => mockAdvanceState(...args),
}));

// [why] Must be after all vi.mock calls so the module under test picks up the mocks.
let createEditRun: typeof import('../../persistence').createEditRun;
let updateEditRunStatus: typeof import('../../persistence').updateEditRunStatus;
let createEditStep: typeof import('../../persistence').createEditStep;
let updateEditStep: typeof import('../../persistence').updateEditStep;

beforeAll(async () => {
  const mod = await import('../../persistence');
  createEditRun = mod.createEditRun;
  updateEditRunStatus = mod.updateEditRunStatus;
  createEditStep = mod.createEditStep;
  updateEditStep = mod.updateEditStep;
});

describe('createEditRun', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a run with REQUESTED status', async () => {
    mockValidateTransition.mockReturnValue({ valid: true });

    const result = await createEditRun({
      cardId: 'card-1',
      workspaceId: 'ws-1',
      userId: 'user-1',
      intent: 'Add OAuth support',
    });

    expect(result.status).toBe(201);
    expect(result.data.run.status).toBe('REQUESTED');
    expect(result.data.run.card_id).toBe('card-1');
    expect(result.data.run.workspace_id).toBe('ws-1');
    expect(result.data.run.created_by).toBe('user-1');
    expect(result.data.run.id).toBeTruthy();
  });

  it('creates a run with snapshot_id when provided', async () => {
    mockValidateTransition.mockReturnValue({ valid: true });

    const result = await createEditRun({
      cardId: 'card-2',
      workspaceId: 'ws-2',
      userId: 'user-2',
      intent: 'Refactor API',
      snapshotId: 'snapshot-abc',
    });

    expect(result.data.run.snapshot_id).toBe('snapshot-abc');
  });
});

describe('updateEditRunStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 409 when transition is invalid', async () => {
    mockValidateTransition.mockReturnValue({
      valid: false,
      name: 'invalid-state-transition',
      message: 'Cannot transition from REQUESTED to FILES_CREATED',
    });

    const run = {
      id: 'run-1',
      card_id: 'card-1',
      workspace_id: 'ws-1',
      created_by: 'user-1',
      status: 'REQUESTED' as const,
      snapshot_id: null,
      file_scope_plan: null,
      error_message: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      completed_at: null,
    };

    const result = await updateEditRunStatus({
      run,
      nextStatus: 'FILES_CREATED' as const,
    });

    expect(result.status).toBe(409);
    if ('name' in result) {
      expect(result.name).toBe('invalid-state-transition');
    }
  });

  it('returns updated run on valid transition', async () => {
    const run = {
      id: 'run-1',
      card_id: 'card-1',
      workspace_id: 'ws-1',
      created_by: 'user-1',
      status: 'REQUESTED' as const,
      snapshot_id: null,
      file_scope_plan: null,
      error_message: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      completed_at: null,
    };

    const advanced = {
      ...run,
      status: 'CONTEXT_GATHERED' as const,
      updated_at: '2026-01-01T01:00:00.000Z',
    };

    mockValidateTransition.mockReturnValue({ valid: true });
    mockAdvanceState.mockReturnValue(advanced);

    const result = await updateEditRunStatus({
      run,
      nextStatus: 'CONTEXT_GATHERED' as const,
    });

    expect(result.status).toBe(200);
    if ('data' in result) {
      expect(result.data.run.status).toBe('CONTEXT_GATHERED');
    }
  });
});

describe('createEditStep and updateEditStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a step with PENDING status and attempt 1', async () => {
    mockValidateTransition.mockReturnValue({ valid: true });

    const step = await createEditStep({
      runId: 'run-1',
      stepName: 'context_gather',
      input: { intent: 'test' },
    });

    expect(step.status).toBe('PENDING');
    expect(step.attempt).toBe(1);
    expect(step.step_name).toBe('context_gather');
    expect(step.run_id).toBe('run-1');
    expect(step.input).toEqual({ intent: 'test' });
  });

  it('updates step with incremented attempt', async () => {
    mockValidateTransition.mockReturnValue({ valid: true });

    const step = {
      id: 'step-1',
      run_id: 'run-1',
      step_name: 'context_gather' as const,
      status: 'PENDING' as const,
      attempt: 1,
      input: { intent: 'test' },
      output: null,
      error: null,
      started_at: null,
      completed_at: null,
      created_at: '2026-01-01T00:00:00.000Z',
    };

    const updated = await updateEditStep({
      step,
      status: 'RUNNING' as const,
    });

    expect(updated.status).toBe('RUNNING');
    expect(updated.attempt).toBe(2);
    expect(updated.started_at).not.toBeNull();
  });

  it('marks step SUCCEEDED with output', async () => {
    mockValidateTransition.mockReturnValue({ valid: true });

    const step = {
      id: 'step-2',
      run_id: 'run-1',
      step_name: 'context_gather' as const,
      status: 'RUNNING' as const,
      attempt: 2,
      input: null,
      output: null,
      error: null,
      started_at: '2026-01-01T00:00:00.000Z',
      completed_at: null,
      created_at: '2026-01-01T00:00:00.000Z',
    };

    const updated = await updateEditStep({
      step,
      status: 'SUCCEEDED' as const,
      output: { chunks: 5 },
    });

    expect(updated.status).toBe('SUCCEEDED');
    expect(updated.attempt).toBe(3);
    expect(updated.output).toEqual({ chunks: 5 });
    expect(updated.completed_at).not.toBeNull();
  });
});
