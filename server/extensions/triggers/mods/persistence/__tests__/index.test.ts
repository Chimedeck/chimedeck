// Tests for trigger run persistence — status transitions, run creation, attempt tracking.
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the db module
const chain: Record<string, ReturnType<typeof vi.fn>> = {};

const mockQueryBuilder = {
  get where() {
    return (chain.where ??= vi.fn(() => mockQueryBuilder));
  },
  get insert() {
    return (chain.insert ??= vi.fn());
  },
  get update() {
    return (chain.update ??= vi.fn());
  },
  get first() {
    return (chain.first ??= vi.fn());
  },
};

const mockDb = vi.fn((_tableName: string) => mockQueryBuilder);

vi.mock('../../../../../common/db', () => ({
  db: mockDb,
}));

function resetMocks() {
  vi.clearAllMocks();
  Object.keys(chain).forEach((key) => delete chain[key]);
}

const makeEnqueueInput = (overrides = {}) => ({
  cardId: 'card-1',
  listId: 'list-1',
  workspaceId: 'ws-1',
  boardId: 'board-1',
  phase: 'SYNC_DOCUMENT' as const,
  moveEventId: 'event-1',
  ...overrides,
});

describe('createTriggerRun', () => {
  beforeEach(resetMocks);

  it('creates a trigger run with QUEUED status', async () => {
    const { createTriggerRun } = await import('../index');

    mockQueryBuilder.insert.mockResolvedValueOnce(undefined);

    const run = await createTriggerRun({
      input: makeEnqueueInput(),
      idempotencyKey: 'key-1',
      tier: 'tier_4',
    });

    expect(run).not.toBeNull();
    expect(run!.status).toBe('QUEUED');
    expect(run!.card_id).toBe('card-1');
    expect(run!.phase).toBe('SYNC_DOCUMENT');
    expect(run!.idempotency_key).toBe('key-1');
    expect(run!.tier).toBe('tier_4');

    // Verify insert was called with correct data
    expect(mockDb).toHaveBeenCalledWith('card_phase_trigger_runs');
    expect(mockQueryBuilder.insert).toHaveBeenCalledTimes(1);
  });

  it('returns null on unique constraint violation (duplicate)', async () => {
    const { createTriggerRun } = await import('../index');

    const uniqueError = new Error('duplicate key value violates unique constraint');
    (uniqueError as any).code = '23505';

    mockQueryBuilder.insert.mockRejectedValueOnce(uniqueError);

    const run = await createTriggerRun({
      input: makeEnqueueInput(),
      idempotencyKey: 'key-1',
      tier: 'tier_4',
    });

    expect(run).toBeNull();
  });

  it('throws on non-unique errors', async () => {
    const { createTriggerRun } = await import('../index');

    const dbError = new Error('connection refused');
    mockQueryBuilder.insert.mockRejectedValueOnce(dbError);

    await expect(
      createTriggerRun({
        input: makeEnqueueInput(),
        idempotencyKey: 'key-1',
        tier: 'tier_4',
      }),
    ).rejects.toThrow('connection refused');
  });
});

describe('createSkippedTriggerRun', () => {
  beforeEach(resetMocks);

  it('creates a trigger run with SKIPPED status and reason', async () => {
    const { createSkippedTriggerRun } = await import('../index');

    mockQueryBuilder.insert.mockResolvedValueOnce(undefined);

    const run = await createSkippedTriggerRun({
      input: makeEnqueueInput(),
      idempotencyKey: 'key-skipped',
      tier: 'tier_1',
      reason: 'Tier too low',
      upgradeHint: 'Upgrade to Business',
    });

    expect(run).not.toBeNull();
    expect(run!.status).toBe('SKIPPED');
    expect(run!.failure_reason).toBe('Tier too low');
    expect(run!.failure_upgrade_hint).toBe('Upgrade to Business');
    expect(run!.completed_at).not.toBeNull(); // SKIPPED is immediately completed
  });
});

describe('updateTriggerRunStatus', () => {
  beforeEach(resetMocks);

  it('transitions QUEUED → RUNNING', async () => {
    const { updateTriggerRunStatus } = await import('../index');

    const queuedRun = {
      id: 'run-1',
      card_id: 'card-1',
      list_id: 'list-1',
      workspace_id: 'ws-1',
      board_id: 'board-1',
      phase: 'SYNC_DOCUMENT',
      status: 'QUEUED',
      tier: 'tier_4',
      move_event_id: 'event-1',
      idempotency_key: 'key-1',
      failure_reason: null,
      failure_upgrade_hint: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      completed_at: null,
    };

    mockQueryBuilder.first.mockResolvedValueOnce(queuedRun);
    mockQueryBuilder.update.mockResolvedValueOnce(1);

    const updated = await updateTriggerRunStatus({
      runId: 'run-1',
      status: 'RUNNING',
    });

    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('RUNNING');
  });

  it('transitions RUNNING → SUCCEEDED with completed_at set', async () => {
    const { updateTriggerRunStatus } = await import('../index');

    const runningRun = {
      id: 'run-1',
      card_id: 'card-1',
      list_id: 'list-1',
      workspace_id: 'ws-1',
      board_id: 'board-1',
      phase: 'SYNC_DOCUMENT',
      status: 'RUNNING',
      tier: 'tier_4',
      move_event_id: 'event-1',
      idempotency_key: 'key-1',
      failure_reason: null,
      failure_upgrade_hint: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      completed_at: null,
    };

    mockQueryBuilder.first.mockResolvedValueOnce(runningRun);
    mockQueryBuilder.update.mockResolvedValueOnce(1);

    const updated = await updateTriggerRunStatus({
      runId: 'run-1',
      status: 'SUCCEEDED',
    });

    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('SUCCEEDED');
    expect(updated!.completed_at).not.toBeNull();
  });

  it('transitions RUNNING → FAILED with failure reason', async () => {
    const { updateTriggerRunStatus } = await import('../index');

    const runningRun = {
      id: 'run-1',
      card_id: 'card-1',
      list_id: 'list-1',
      workspace_id: 'ws-1',
      board_id: 'board-1',
      phase: 'SYNC_DOCUMENT',
      status: 'RUNNING',
      tier: 'tier_4',
      move_event_id: 'event-1',
      idempotency_key: 'key-1',
      failure_reason: null,
      failure_upgrade_hint: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      completed_at: null,
    };

    mockQueryBuilder.first.mockResolvedValueOnce(runningRun);
    mockQueryBuilder.update.mockResolvedValueOnce(1);

    const updated = await updateTriggerRunStatus({
      runId: 'run-1',
      status: 'FAILED',
      failureReason: 'All retries exhausted',
    });

    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('FAILED');
    expect(updated!.failure_reason).toBe('All retries exhausted');
    expect(updated!.completed_at).not.toBeNull();
  });

  it('rejects invalid transition (SUCCEEDED → RUNNING)', async () => {
    const { updateTriggerRunStatus } = await import('../index');

    const succeededRun = {
      id: 'run-1',
      card_id: 'card-1',
      list_id: 'list-1',
      workspace_id: 'ws-1',
      board_id: 'board-1',
      phase: 'SYNC_DOCUMENT',
      status: 'SUCCEEDED',
      tier: 'tier_4',
      move_event_id: 'event-1',
      idempotency_key: 'key-1',
      failure_reason: null,
      failure_upgrade_hint: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      completed_at: '2026-01-01T00:00:00.000Z',
    };

    mockQueryBuilder.first.mockResolvedValueOnce(succeededRun);

    const updated = await updateTriggerRunStatus({
      runId: 'run-1',
      status: 'RUNNING',
    });

    expect(updated).toBeNull();
    expect(mockQueryBuilder.update).not.toHaveBeenCalled();
  });

  it('rejects invalid transition (FAILED → SUCCEEDED)', async () => {
    const { updateTriggerRunStatus } = await import('../index');

    const failedRun = {
      id: 'run-1',
      card_id: 'card-1',
      list_id: 'list-1',
      workspace_id: 'ws-1',
      board_id: 'board-1',
      phase: 'SYNC_DOCUMENT',
      status: 'FAILED',
      tier: 'tier_4',
      move_event_id: 'event-1',
      idempotency_key: 'key-1',
      failure_reason: 'exhausted',
      failure_upgrade_hint: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      completed_at: '2026-01-01T00:00:00.000Z',
    };

    mockQueryBuilder.first.mockResolvedValueOnce(failedRun);

    const updated = await updateTriggerRunStatus({
      runId: 'run-1',
      status: 'SUCCEEDED',
    });

    expect(updated).toBeNull();
  });

  it('returns null for non-existent run', async () => {
    const { updateTriggerRunStatus } = await import('../index');

    mockQueryBuilder.first.mockResolvedValueOnce(null);

    const updated = await updateTriggerRunStatus({
      runId: 'nonexistent',
      status: 'RUNNING',
    });

    expect(updated).toBeNull();
  });
});

describe('createTriggerAttempt', () => {
  beforeEach(resetMocks);

  it('creates an attempt record linked to a run', async () => {
    const { createTriggerAttempt } = await import('../index');

    mockQueryBuilder.insert.mockResolvedValueOnce(undefined);

    const attempt = await createTriggerAttempt({
      runId: 'run-1',
      attemptNumber: 2,
    });

    expect(attempt).toBeDefined();
    expect(attempt.run_id).toBe('run-1');
    expect(attempt.attempt_number).toBe(2);
    expect(attempt.status).toBe('RUNNING');
    expect(attempt.started_at).not.toBeNull();

    expect(mockDb).toHaveBeenCalledWith('card_phase_trigger_attempts');
    expect(mockQueryBuilder.insert).toHaveBeenCalledTimes(1);
  });
});

describe('completeTriggerAttempt', () => {
  beforeEach(resetMocks);

  it('marks attempt as SUCCEEDED', async () => {
    const { completeTriggerAttempt } = await import('../index');

    mockQueryBuilder.update.mockResolvedValueOnce(1);

    await completeTriggerAttempt({
      attemptId: 'attempt-1',
      success: true,
    });

    expect(mockDb).toHaveBeenCalledWith('card_phase_trigger_attempts');
    expect(mockQueryBuilder.where).toHaveBeenCalledWith({ id: 'attempt-1' });
    expect(mockQueryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'SUCCEEDED',
        completed_at: expect.any(String),
      }),
    );
  });

  it('marks attempt as FAILED with error details', async () => {
    const { completeTriggerAttempt } = await import('../index');

    mockQueryBuilder.update.mockResolvedValueOnce(1);

    await completeTriggerAttempt({
      attemptId: 'attempt-2',
      success: false,
      errorMessage: 'timeout',
      errorPayload: '{"details":"connection refused"}',
    });

    expect(mockQueryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'FAILED',
        error_message: 'timeout',
        error_payload: '{"details":"connection refused"}',
      }),
    );
  });
});
