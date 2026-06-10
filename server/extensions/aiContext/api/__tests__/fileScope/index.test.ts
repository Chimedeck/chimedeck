// Integration tests for POST /api/v1/cards/:cardId/ai/file-scope handler.
// [why] Patch fileScopeApiDeps directly rather than using vi.mock from a
// deeply nested test directory — Bun's vi.mock path resolution is unreliable
// when tests are nested deeper than the mock target.
import { describe, it, expect, afterAll, vi } from 'vitest';
import { handleFileScope, fileScopeApiDeps } from '../../fileScope/index';

describe('handleFileScope', () => {
  const originalDeps = { ...fileScopeApiDeps };

  afterAll(() => {
    Object.assign(fileScopeApiDeps, originalDeps);
  });

  it('returns 401 when authentication fails', async () => {
    fileScopeApiDeps.authenticate = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ name: 'unauthorized' }), { status: 401 }),
    );
    fileScopeApiDeps.requireWorkspaceMembership = vi.fn();

    const result = await handleFileScope(
      new Request('http://localhost/api/v1/cards/card-abc/ai/file-scope', {
        method: 'POST',
        body: JSON.stringify({ intent: 'build auth' }),
      }),
      'card-abc',
    );

    expect(result.status).toBe(401);
  });

  it('returns 400 when intent is missing', async () => {
    fileScopeApiDeps.authenticate = vi.fn().mockResolvedValue(null);
    fileScopeApiDeps.requireWorkspaceMembership = vi.fn().mockResolvedValue(null);

    const result = await handleFileScope(
      new Request('http://localhost/api/v1/cards/card-abc/ai/file-scope', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      'card-abc',
    );

    expect(result.status).toBe(400);
    const body = (await result.json()) as { name: string };
    expect(body.name).toBe('missing-intent');
  });

  it('returns gather error when pipeline fails', async () => {
    fileScopeApiDeps.authenticate = vi.fn().mockResolvedValue(null);
    fileScopeApiDeps.requireWorkspaceMembership = vi.fn().mockResolvedValue(null);
    fileScopeApiDeps.runGatherPipeline = vi.fn().mockResolvedValue({
      status: 403,
      name: 'path-not-allowed',
      message: 'Blocked',
    });

    const result = await handleFileScope(
      new Request('http://localhost/api/v1/cards/card-abc/ai/file-scope', {
        method: 'POST',
        body: JSON.stringify({ intent: 'build auth', focusPaths: ['.env'] }),
      }),
      'card-abc',
    );

    expect(result.status).toBe(403);
  });

  it('returns 200 with file scope plan on success', async () => {
    fileScopeApiDeps.authenticate = vi.fn().mockResolvedValue(null);
    fileScopeApiDeps.requireWorkspaceMembership = vi.fn().mockResolvedValue(null);
    fileScopeApiDeps.runGatherPipeline = vi.fn().mockResolvedValue({
      status: 200,
      data: {
        chunks: [{ source: 'docs', sourcePath: 'specs/test.md', content: 'test', confidence: 0.9 }],
        sourceCounts: { docs: 1, code: 0, cards: 0, git: 0 },
        totalReturned: 1,
        timeouts: [],
      },
    });
    fileScopeApiDeps.applyBudget = vi.fn().mockImplementation(({ chunks }) => ({
      chunks, budget: { totalTokens: 10, maxTokens: 8000, totalSizeBytes: 100, maxSizeBytes: 100000, exceeded: false, droppedChunks: 0 },
    }));
    fileScopeApiDeps.detectDuplicates = vi.fn().mockResolvedValue([]);
    fileScopeApiDeps.analyseImpact = vi.fn().mockReturnValue({ likelyImpactedFiles: [], overallOverlapScore: 0 });
    fileScopeApiDeps.planFileScope = vi.fn().mockReturnValue({
      files: [{ filePath: 'specs/architecture/new.md', decision: 'create', rationale: 'New file needed', confidence: 0.8 }],
      possibleDuplicateCards: [],
      likelyImpactedFiles: [],
      confidence: 0.8,
      snapshotId: '',
    });
    fileScopeApiDeps.persistSnapshot = vi.fn().mockResolvedValue({ snapshotId: 'snap-123', snapshotHash: 'abc' });

    const result = await handleFileScope(
      new Request('http://localhost/api/v1/cards/card-abc/ai/file-scope', {
        method: 'POST',
        body: JSON.stringify({ intent: 'build authentication system' }),
      }),
      'card-abc',
    );

    expect(result.status).toBe(200);
    const body = (await result.json()) as { data: { files: unknown[]; snapshotId: string } };
    expect(body.data.files).toBeDefined();
    expect(body.data.files.length).toBeGreaterThan(0);
    expect(body.data.snapshotId).toBe('snap-123');
  });

  it('returns 400 when body is not valid JSON', async () => {
    fileScopeApiDeps.authenticate = vi.fn().mockResolvedValue(null);
    fileScopeApiDeps.requireWorkspaceMembership = vi.fn().mockResolvedValue(null);

    const result = await handleFileScope(
      new Request('http://localhost/api/v1/cards/card-abc/ai/file-scope', {
        method: 'POST',
        body: 'not json',
      }),
      'card-abc',
    );

    expect(result.status).toBe(400);
    const body = (await result.json()) as { name: string };
    expect(body.name).toBe('invalid-request-body');
  });
});
