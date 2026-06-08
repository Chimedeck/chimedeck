// Focused tests for GET /api/v1/boards/:boardId/specs/manifest
// Covers RBAC, the "no URL configured" 403 case, and the "load failed" 403 case
// (covers all clone failures — repo not cloned, app not installed, network, etc.).
import { beforeEach, describe, expect, it } from 'bun:test';

type BoardRow = {
  id: string;
  workspace_id: string;
  state: 'ACTIVE' | 'ARCHIVED';
  github_project_url: string | null;
};

let board: BoardRow;
let authenticated = true;
let callerRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'GUEST' = 'MEMBER';

const { handleLoadSpecsManifest, specsLoadDeps } = await import('../load');

// ── Shared mock helpers ───────────────────────────────────────────────────────

function makeAuthMock() {
  return async (req: Request & { currentUser?: { id: string } }) => {
    if (!authenticated) return Response.json({ name: 'unauthorized' }, { status: 401 });
    req.currentUser = { id: 'user-1' };
    return null;
  };
}

function makeBoardAccessMock() {
  return async (req: Request & { board?: BoardRow }, boardId: string) => {
    if (board.id !== boardId) return Response.json({ name: 'board-not-found' }, { status: 404 });
    req.board = board;
    return null;
  };
}

function makeMembershipMock() {
  return async (req: Request & { callerRole?: string; workspaceId?: string }, workspaceId: string) => {
    req.workspaceId = workspaceId;
    req.callerRole = callerRole;
    return null;
  };
}

function makeRoleMock() {
  return (req: { callerRole?: string }, minRole: string) => {
    const ranks: Record<string, number> = { OWNER: 4, ADMIN: 3, MEMBER: 2, VIEWER: 1, GUEST: 0 };
    const callerRank = ranks[req.callerRole ?? ''] ?? -1;
    const minRank = ranks[minRole] ?? 0;
    if (callerRank < minRank) return Response.json({ name: 'insufficient-role' }, { status: 403 });
    return null;
  };
}

function makeLoadRequest() {
  return new Request('http://localhost/api/v1/boards/board-1/specs/manifest');
}

function resetDeps() {
  board = {
    id: 'board-1',
    workspace_id: 'ws-1',
    state: 'ACTIVE',
    github_project_url: 'https://github.com/orgs/journeyhorizon/projects/12',
  };
  authenticated = true;
  callerRole = 'MEMBER';

  specsLoadDeps.authenticate = makeAuthMock();
  specsLoadDeps.requireBoardAccess = makeBoardAccessMock();
  specsLoadDeps.requireWorkspaceMembership = makeMembershipMock();
  specsLoadDeps.requireRole = makeRoleMock();
  specsLoadDeps.downloadRepositoryFromProjectUrl = async () => ({
    repoPath: '/tmp/fake-repo',
    ref: 'main',
    fetchedAt: new Date().toISOString(),
  });
  specsLoadDeps.buildSpecsManifest = async () => ({
    ref: 'main',
    fetchedAt: '2025-01-01T00:00:00Z',
    files: [{ path: 'specs/overview.md', sizeBytes: 100 }],
    etag: 'etag-abc',
  });
  specsLoadDeps.now = () => new Date('2025-01-01T00:00:00Z');
}

beforeEach(() => { resetDeps(); });

// Module-level caches from the manifest loader. These persist across test
// files when running the full suite, so we clear them explicitly here to
// avoid mock leakage from sibling tests in the same folder.
const { specsManifestCache, specsManifestInflight } = require('../../mods/specs/cache') as {
  specsManifestCache: Map<string, unknown>;
  specsManifestInflight: Map<string, unknown>;
};

beforeEach(() => {
  specsManifestCache.clear();
  specsManifestInflight.clear();
  resetDeps();
});

// ── Authorization ─────────────────────────────────────────────────────────────

describe('GET /api/v1/boards/:boardId/specs/manifest — authorization', () => {
  it('returns 401 for unauthenticated requests', async () => {
    authenticated = false;
    const res = await handleLoadSpecsManifest(makeLoadRequest(), 'board-1');
    expect(res.status).toBe(401);
  });

  it('returns 403 for VIEWER role', async () => {
    callerRole = 'VIEWER';
    const res = await handleLoadSpecsManifest(makeLoadRequest(), 'board-1');
    expect(res.status).toBe(403);
  });
});

// ── 403 "not configured" ──────────────────────────────────────────────────────

describe('GET /api/v1/boards/:boardId/specs/manifest — 403 not configured', () => {
  it('returns 403 with the configured-repository hint when no github_project_url is set', async () => {
    board.github_project_url = null;
    const res = await handleLoadSpecsManifest(makeLoadRequest(), 'board-1');
    expect(res.status).toBe(403);
    const body = await res.json() as { name: string; data: { message: string } };
    expect(body.name).toBe('specs-not-configured');
    expect(body.data.message).toContain('configure your Github documentation');
  });
});

// ── 403 "load failed" (covers all clone failure modes) ───────────────────────

describe('GET /api/v1/boards/:boardId/specs/manifest — 403 load failed', () => {
  it('returns 403 with the access-denied hint when the repo cannot be cloned', async () => {
    specsLoadDeps.downloadRepositoryFromProjectUrl = async () => {
      throw new Error('github-repository-download-failed');
    };
    const res = await handleLoadSpecsManifest(makeLoadRequest(), 'board-1');
    expect(res.status).toBe(403);
    const body = await res.json() as { name: string; data: { message: string } };
    expect(body.name).toBe('specs-load-failed');
    expect(body.data.message).toContain('do not have access to this respository');
  });

  it('returns 403 when no installation token is available for the configured repo', async () => {
    specsLoadDeps.downloadRepositoryFromProjectUrl = async () => {
      throw new Error('github-app-installation-not-found');
    };
    const res = await handleLoadSpecsManifest(makeLoadRequest(), 'board-1');
    expect(res.status).toBe(403);
    const body = await res.json() as { name: string; data: { message: string } };
    expect(body.name).toBe('specs-load-failed');
  });
});

// ── Success ───────────────────────────────────────────────────────────────────

describe('GET /api/v1/boards/:boardId/specs/manifest — success', () => {
  it('returns 200 with the manifest and an ETag header', async () => {
    const res = await handleLoadSpecsManifest(makeLoadRequest(), 'board-1');
    expect(res.status).toBe(200);
    expect(res.headers.get('ETag')).toBe('"etag-abc"');
    const body = await res.json() as { data: { ref: string; files: { path: string }[]; etag: string } };
    expect(body.data.ref).toBe('main');
    expect(body.data.files[0]?.path).toBe('specs/overview.md');
  });

  it('returns 304 when If-None-Match matches the current ETag', async () => {
    const req = new Request('http://localhost/api/v1/boards/board-1/specs/manifest', {
      headers: { 'If-None-Match': '"etag-abc"' },
    });
    const res = await handleLoadSpecsManifest(req, 'board-1');
    expect(res.status).toBe(304);
  });
});
