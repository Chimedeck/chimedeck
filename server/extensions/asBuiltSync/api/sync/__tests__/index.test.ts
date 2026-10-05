// As-built sync handler tests (Sprint 176).
// [why] Verifies the API handler returns correct status codes and responses
// for authentication, card resolution, idempotency, and run creation.
import { describe, it, expect, beforeEach, mock } from 'bun:test';

// [why] Mock the DB chain so the handler's card lookup succeeds.
const mockDbQuery = {
  where: (() => mockDbQuery) as any,
  join: (() => mockDbQuery) as any,
  select: (() => mockDbQuery) as any,
  first: (async () => ({ id: 'card-1', board_id: 'board-1', title: 'Test Card' })) as any,
};

// [why] mock.module path is relative to this test file.
// Test: asBuiltSync/api/sync/__tests__/index.test.ts
// Handler: asBuiltSync/api/sync/index.ts
// Handler imports: ../../../../common/db → server/common/db
// Test needs: ../../../../../common/db → server/common/db
mock.module('../../../../../common/db', () => ({
  db: (() => mockDbQuery) as any,
}));

// [why] Mock persistence + activities to avoid side effects.
mock.module('../../../mods/persistence', () => ({
  createAsBuiltSyncRun: mock(async () => ({
    id: 'run-1',
    card_id: 'card-1',
    workspace_id: 'ws-1',
    created_by: 'user-1',
    status: 'QUEUED',
    trigger_run_id: null,
    evidence: null,
    output_files: null,
    commit_hash: null,
    error_message: null,
    created_at: '2026-06-10T12:00:00.000Z',
    updated_at: '2026-06-10T12:00:00.000Z',
    completed_at: null,
  })),
  hasSucceededAsBuiltRun: mock(async () => false),
}));

mock.module('../../../mods/activities', () => ({
  emitAsBuiltStarted: mock(async () => {}),
}));

// [why] Mock pipeline to avoid async side effects.
mock.module('../../../mods/pipeline', () => ({
  runAsBuiltSyncPipeline: mock(async () => ({ success: true })),
}));

const { handleSyncAsBuilt } = await import('../index');

describe('handleSyncAsBuilt', () => {
  function makeReq(overrides: Record<string, any> = {}): Request {
    return {
      currentUser: { id: 'user-1' },
      workspaceId: 'ws-1',
      ...overrides,
    } as any;
  }

  it('should return 401 when user is not authenticated', async () => {
    const req = makeReq({ currentUser: undefined });
    const res = await handleSyncAsBuilt(req, 'card-1');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.name).toBe('unauthorized');
  });

  it('should return 400 when workspace context is missing', async () => {
    const req = makeReq({ workspaceId: undefined });
    const res = await handleSyncAsBuilt(req, 'card-1');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.name).toBe('workspace-not-found');
  });

  it('should return 404 when card does not exist', async () => {
    mockDbQuery.first = (async () => null) as any;
    const req = makeReq();
    const res = await handleSyncAsBuilt(req, 'card-1');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.name).toBe('card-not-found');
    // Reset
    mockDbQuery.first = (async () => ({
      id: 'card-1',
      board_id: 'board-1',
      title: 'Test Card',
    })) as any;
  });

  it('should return 409 when a succeeded run already exists', async () => {
    const { hasSucceededAsBuiltRun } = await import('../../../mods/persistence');
    (hasSucceededAsBuiltRun as any).mockImplementation(async () => true);

    const req = makeReq();
    const res = await handleSyncAsBuilt(req, 'card-1');
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.name).toBe('as-built-already-synced');

    (hasSucceededAsBuiltRun as any).mockImplementation(async () => false);
  });

  it('should return 201 with run data on successful creation', async () => {
    const { createAsBuiltSyncRun } = await import('../../../mods/persistence');
    (createAsBuiltSyncRun as any).mockClear();
    (createAsBuiltSyncRun as any).mockImplementation(async () => ({
      id: 'run-1',
      card_id: 'card-1',
      workspace_id: 'ws-1',
      created_by: 'user-1',
      status: 'QUEUED',
      trigger_run_id: null,
      evidence: null,
      output_files: null,
      commit_hash: null,
      error_message: null,
      created_at: '2026-06-10T12:00:00.000Z',
      updated_at: '2026-06-10T12:00:00.000Z',
      completed_at: null,
    }));

    const req = makeReq();
    const res = await handleSyncAsBuilt(req, 'card-1');
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.run.id).toBe('run-1');
    expect(body.data.run.status).toBe('QUEUED');
  });
});
