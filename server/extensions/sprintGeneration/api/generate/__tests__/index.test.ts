// Tests for the generate sprint API handler.
// Verifies auth, workspace membership, card existence, idempotency,
// and successful run creation.
import { describe, it, expect, mock, beforeEach } from 'bun:test';

// [why] Shared mock DB — ALL test files mock common/db identically to avoid
// cross-file mock.module contamination in Bun.
import {
  sharedMockDb,
  sharedMockChain,
  sharedMockFirst,
  resetMockDb,
} from '../../../__tests__/mockDb';
import {
  mockCreateSprintGenRun,
  mockHasSucceededRun,
  mockCreateGeneratedSprintCard,
  mockGetGeneratedSprintCards,
  mockGetSprintGenRun,
  mockUpdateSprintGenRunStatus,
  persistenceMockModule,
} from '../../../__tests__/mockPersistence';

const mockEmitStarted = mock(async () => {});

// [why] ALL test files mock common/db with the SAME shared mock object.
// The last mock.module registration wins; they all point to the same object.
mock.module('../../../../../common/db', () => ({
  db: sharedMockDb,
}));

mock.module('../../../mods/persistence', persistenceMockModule);

mock.module('../../../mods/activities', () => ({
  emitSprintGenStarted: mockEmitStarted,
  emitSprintGenArtifactCreated: mock(async () => {}),
  emitSprintGenCardCreated: mock(async () => {}),
  emitSprintGenQuotaExceeded: mock(async () => {}),
  emitSprintGenCompleted: mock(async () => {}),
  emitSprintGenFailed: mock(async () => {}),
  emitSprintGenActivity: mock(async () => {}),
  activitiesDeps: {
    writeActivity: mock(async () => ({ id: 'activity-1', action: 'test', payload: '{}' })),
    publishCardActivityEvent: mock(async () => {}),
  },
}));

mock.module('../../../mods/pipeline', () => ({
  runSprintGenerationPipeline: mock(async () => ({ success: true })),
}));

// ── Helpers ──

function makeRequest(overrides: Record<string, any> = {}): Request {
  const req = new Request('http://localhost/api/v1/cards/card-1/sprint/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  Object.assign(req, overrides);
  return req;
}

function makeAuthRequest(overrides: Record<string, any> = {}): Request {
  return makeRequest({
    currentUser: { id: 'user-1' },
    workspaceId: 'ws-1',
    ...overrides,
  });
}

// ── Tests ──

describe('handleGenerateSprint', () => {
  beforeEach(() => {
    sharedMockFirst.mockReset();
    mockCreateSprintGenRun.mockClear();
    mockHasSucceededRun.mockClear();
    mockEmitStarted.mockClear();
    mockHasSucceededRun.mockImplementation(async () => false);

    // Default: card found — queue up card lookup result
    sharedMockFirst.mockResolvedValue({ id: 'card-1', board_id: 'board-1', title: 'Test Card' });
  });

  it('returns 401 when not authenticated', async () => {
    const { handleGenerateSprint } = await import('../index');
    const req = makeRequest();
    const response = await handleGenerateSprint(req, 'card-1');
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.name).toBe('unauthorized');
  });

  it('returns 400 when workspace is not in context', async () => {
    const { handleGenerateSprint } = await import('../index');
    const req = makeRequest({ currentUser: { id: 'user-1' } });
    const response = await handleGenerateSprint(req, 'card-1');
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.name).toBe('workspace-not-found');
  });

  it('returns 400 when request body is invalid JSON', async () => {
    const { handleGenerateSprint } = await import('../index');
    const req = makeRequest({
      currentUser: { id: 'user-1' },
      workspaceId: 'ws-1',
      json: async () => {
        throw new Error('Invalid JSON');
      },
    });
    const response = await handleGenerateSprint(req, 'card-1');
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.name).toBe('invalid-request-body');
  });

  it('returns 404 when card does not exist', async () => {
    sharedMockFirst.mockReset();
    sharedMockFirst.mockResolvedValue(null); // card not found
    const { handleGenerateSprint } = await import('../index');
    const response = await handleGenerateSprint(makeAuthRequest(), 'card-1');
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.name).toBe('card-not-found');
  });

  it('returns 409 when card already has a succeeded generation run', async () => {
    mockHasSucceededRun.mockImplementation(async () => true);
    const { handleGenerateSprint } = await import('../index');
    const response = await handleGenerateSprint(makeAuthRequest(), 'card-1');
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.name).toBe('sprint-already-generated');
  });

  it('returns 201 with QUEUED run on successful creation', async () => {
    const { handleGenerateSprint } = await import('../index');
    const response = await handleGenerateSprint(makeAuthRequest(), 'card-1');
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.run).toBeDefined();
    expect(body.data.run.status).toBe('QUEUED');
    expect(body.data.run.requirement_packet).toBeUndefined();
    expect(mockCreateSprintGenRun).toHaveBeenCalled();
    expect(mockEmitStarted).toHaveBeenCalled();
  });

  it('accepts optional snapshotId in the request body', async () => {
    const req = makeAuthRequest({
      json: async () => ({ snapshotId: 'snap-1' }),
    });
    const { handleGenerateSprint } = await import('../index');
    const response = await handleGenerateSprint(req, 'card-1');
    expect(response.status).toBe(201);
    const callArgs = mockCreateSprintGenRun.mock.calls[0]?.[0] as any;
    expect(callArgs?.snapshotId).toBe('snap-1');
  });

  it('handles unexpected errors with 500', async () => {
    sharedMockFirst.mockReset();
    sharedMockFirst.mockImplementation(async () => {
      throw new Error('DB connection lost');
    });
    const { handleGenerateSprint } = await import('../index');
    const response = await handleGenerateSprint(makeAuthRequest(), 'card-1');
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.name).toBe('internal-error');
  });
});
