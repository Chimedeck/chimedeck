// Integration tests for POST /api/v1/cards/:cardId/ai/context/gather handler.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockRequireMembership = vi.fn();
const mockAuthenticate = vi.fn();
const mockRunGatherPipeline = vi.fn();

// [why] Mock transitively-imported modules to prevent Bun.global access in test env.
vi.mock('../../../../common/db', () => ({
  db: vi.fn(() => ({})),
}));

vi.mock('../../../../../config/env', () => ({
  env: {
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    JWT_PRIVATE_KEY: 'test',
    JWT_PUBLIC_KEY: 'test',
  },
}));

vi.mock('../../../auth/middlewares/authentication', () => ({
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
}));

vi.mock('../../../../middlewares/permissionManager', () => ({
  requireWorkspaceMembership: (...args: unknown[]) => mockRequireMembership(...args),
}));

vi.mock('../../mods/gather', () => ({
  runGatherPipeline: (...args: unknown[]) => mockRunGatherPipeline(...args),
}));

describe('handleGatherContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when authentication fails', async () => {
    mockAuthenticate.mockResolvedValueOnce(
      new Response(JSON.stringify({ name: 'unauthorized' }), { status: 401 })
    );

    const { handleGatherContext } = await import('../gather');

    const result = await handleGatherContext(
      new Request('http://localhost/api/v1/cards/card-abc/ai/context/gather', {
        method: 'POST',
        body: JSON.stringify({ intent: 'build auth' }),
      }),
      'card-abc'
    );

    expect(result.status).toBe(401);
  });

  it('returns 400 when intent is missing', async () => {
    mockAuthenticate.mockResolvedValueOnce(null);
    mockRequireMembership.mockResolvedValueOnce(null);

    const { handleGatherContext } = await import('../gather');

    const result = await handleGatherContext(
      new Request('http://localhost/api/v1/cards/card-abc/ai/context/gather', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      'card-abc'
    );

    expect(result.status).toBe(400);
    const body = (await result.json()) as { name: string };
    expect(body.name).toBe('missing-intent');
  });

  it('returns 400 when body is not valid JSON', async () => {
    mockAuthenticate.mockResolvedValueOnce(null);
    mockRequireMembership.mockResolvedValueOnce(null);

    const { handleGatherContext } = await import('../gather');

    const result = await handleGatherContext(
      new Request('http://localhost/api/v1/cards/card-abc/ai/context/gather', {
        method: 'POST',
        body: 'not json',
      }),
      'card-abc'
    );

    expect(result.status).toBe(400);
    const body = (await result.json()) as { name: string };
    expect(body.name).toBe('invalid-request-body');
  });

  it('returns 200 with ranked chunks on success', async () => {
    mockAuthenticate.mockResolvedValueOnce(null);
    mockRequireMembership.mockResolvedValueOnce(null);

    mockRunGatherPipeline.mockResolvedValueOnce({
      status: 200,
      data: {
        chunks: [
          {
            source: 'docs',
            sourcePath: 'specs/architecture/requirements.md',
            content: 'The system must authenticate users.',
            confidence: 0.95,
          },
        ],
        sourceCounts: { docs: 1, code: 0, cards: 0, git: 0 },
        totalReturned: 1,
        timeouts: [],
      },
    });

    const { handleGatherContext } = await import('../gather');

    const result = await handleGatherContext(
      new Request('http://localhost/api/v1/cards/card-abc/ai/context/gather', {
        method: 'POST',
        body: JSON.stringify({ intent: 'authentication system' }),
      }),
      'card-abc'
    );

    expect(result.status).toBe(200);
    const body = (await result.json()) as { data: { chunks: unknown[]; totalReturned: number } };
    expect(body.data.chunks).toHaveLength(1);
    expect(body.data.totalReturned).toBe(1);
  });

  it('returns pipeline error status when non-200', async () => {
    mockAuthenticate.mockResolvedValueOnce(null);
    mockRequireMembership.mockResolvedValueOnce(null);

    mockRunGatherPipeline.mockResolvedValueOnce({
      status: 403,
      name: 'path-not-allowed',
      message: 'Path ".env" is not in the allowlist',
    });

    const { handleGatherContext } = await import('../gather');

    const result = await handleGatherContext(
      new Request('http://localhost/api/v1/cards/card-abc/ai/context/gather', {
        method: 'POST',
        body: JSON.stringify({ intent: 'test', focusPaths: ['.env'] }),
      }),
      'card-abc'
    );

    expect(result.status).toBe(403);
    const body = (await result.json()) as { name: string };
    expect(body.name).toBe('path-not-allowed');
  });
});
