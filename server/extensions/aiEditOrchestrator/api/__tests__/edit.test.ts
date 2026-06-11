// Integration tests for POST /api/v1/cards/:cardId/ai/edit handler.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockRequireMembership = vi.fn();
const mockAuthenticate = vi.fn();
const mockCreateEditRun = vi.fn();

globalThis.Bun = {
  file: vi.fn().mockReturnValue({ exists: () => Promise.resolve(false), text: () => Promise.resolve('') }),
  write: vi.fn().mockResolvedValue(undefined),
  spawnSync: vi.fn().mockReturnValue({ exitCode: 0, stdout: Buffer.from(''), stderr: Buffer.from('') }),
} as any;

vi.mock('../../../../common/db', () => ({ db: vi.fn(() => ({})) }));
vi.mock('../../../../../config/env', () => ({
  env: { DATABASE_URL: 'postgres://test:test@localhost:5432/test', JWT_PRIVATE_KEY: 'test', JWT_PUBLIC_KEY: 'test' },
}));
vi.mock('../../../auth/middlewares/authentication', () => ({
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
}));
vi.mock('../../../../middlewares/permissionManager', () => ({
  requireWorkspaceMembership: (...args: unknown[]) => mockRequireMembership(...args),
}));
vi.mock('../../mods/persistence', () => ({
  createEditRun: (...args: unknown[]) => mockCreateEditRun(...args),
  createEditStep: vi.fn().mockResolvedValue({ status: 201, data: { id: 'step-1' } }),
  updateEditStep: vi.fn().mockResolvedValue({ status: 200, data: {} }),
  updateEditRunStatus: vi.fn().mockResolvedValue({ status: 200, data: {} }),
  getEditRun: vi.fn().mockResolvedValue({ status: 200, data: { run: {} } }),
}));

describe('handleCreateEditRun', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 401 when authentication fails', async () => {
    mockAuthenticate.mockResolvedValueOnce(new Response(JSON.stringify({ name: 'unauthorized' }), { status: 401 }));
    const { handleCreateEditRun } = await import('../edit');
    const result = await handleCreateEditRun(
      new Request('http://localhost/api/v1/cards/card-abc/ai/edit', { method: 'POST', body: JSON.stringify({ intent: 'test' }) }),
      'card-abc',
    );
    expect(result.status).toBe(401);
  });

  it('returns 400 when intent is missing', async () => {
    mockAuthenticate.mockResolvedValueOnce(null);
    mockRequireMembership.mockResolvedValueOnce(null);
    const { handleCreateEditRun } = await import('../edit');
    const result = await handleCreateEditRun(
      new Request('http://localhost/api/v1/cards/card-abc/ai/edit', { method: 'POST', body: JSON.stringify({}) }),
      'card-abc',
    );
    expect(result.status).toBe(400);
    const body = (await result.json()) as { name: string };
    expect(body.name).toBe('missing-intent');
  });

  it('returns 400 when body is not valid JSON', async () => {
    mockAuthenticate.mockResolvedValueOnce(null);
    mockRequireMembership.mockResolvedValueOnce(null);
    const { handleCreateEditRun } = await import('../edit');
    const result = await handleCreateEditRun(
      new Request('http://localhost/api/v1/cards/card-abc/ai/edit', { method: 'POST', body: 'not json' }),
      'card-abc',
    );
    expect(result.status).toBe(400);
    const body = (await result.json()) as { name: string };
    expect(body.name).toBe('invalid-request-body');
  });

  it('returns 201 with run on success', async () => {
    mockAuthenticate.mockResolvedValueOnce(null);
    mockRequireMembership.mockResolvedValueOnce(null);
    const mockRun = { id: 'run-1', card_id: 'card-abc', workspace_id: 'ws-1', created_by: 'user-1', status: 'REQUESTED', snapshot_id: null, file_scope_plan: null, error_message: null, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z', completed_at: null };
    mockCreateEditRun.mockResolvedValueOnce({ status: 201, data: { run: mockRun } });

    const mod = await import('../edit');
    // [why] Override runPipeline after import to avoid orchestrator transitive deps
    (mod.editApiDeps as { runPipeline: typeof vi.fn }).runPipeline = vi.fn().mockResolvedValue(undefined);

    const req = { json: () => Promise.resolve({ intent: 'add OAuth support' }), currentUser: { id: 'user-1' }, workspaceId: 'ws-1' } as unknown as Request;
    const result = await mod.handleCreateEditRun(req, 'card-abc');
    expect(result.status).toBe(201);
    const body = (await result.json()) as { data: { run: { id: string; status: string } } };
    expect(body.data.run.id).toBe('run-1');
    expect(body.data.run.status).toBe('REQUESTED');
  });

  it('returns 401 when currentUser identity is missing', async () => {
    mockAuthenticate.mockResolvedValueOnce(null);
    mockRequireMembership.mockResolvedValueOnce(null);
    const { handleCreateEditRun } = await import('../edit');
    const req = new Request('http://localhost/api/v1/cards/card-abc/ai/edit', { method: 'POST', body: JSON.stringify({ intent: 'test intent' }) });
    const result = await handleCreateEditRun(req, 'card-abc');
    expect(result.status).toBe(401);
    const body = (await result.json()) as { name: string };
    expect(body.name).toBe('unauthorized');
  });
});
