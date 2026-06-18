// Focused tests for GET /api/v1/boards/:boardId/specs/files?path=<rel>
// Covers RBAC, the "no URL configured" 403 case, the "load failed" 403 case,
// and the path-traversal rejection path.
import { beforeEach, describe, expect, it } from 'bun:test';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

type BoardRow = {
  id: string;
  workspace_id: string;
  state: 'ACTIVE' | 'ARCHIVED';
  github_project_url: string | null;
};

let board: BoardRow;
let authenticated = true;
let callerRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'GUEST' = 'MEMBER';

const { handleReadSpecsFile, specsReadDeps } = await import('../read');

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
  return async (
    req: Request & { callerRole?: string; workspaceId?: string },
    workspaceId: string
  ) => {
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

function makeReadRequest(path: string) {
  return new Request(
    `http://localhost/api/v1/boards/board-1/specs/files?path=${encodeURIComponent(path)}`
  );
}

async function createTempRepo(fileName = 'specs/overview.md', content = '# Hello') {
  const repoPath = await mkdtemp(join(tmpdir(), 'read-test-'));
  await mkdir(join(repoPath, 'specs'), { recursive: true });
  await writeFile(join(repoPath, fileName), content);
  return repoPath;
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

  specsReadDeps.authenticate = makeAuthMock();
  specsReadDeps.requireBoardAccess = makeBoardAccessMock();
  specsReadDeps.requireWorkspaceMembership = makeMembershipMock();
  specsReadDeps.requireRole = makeRoleMock();
  specsReadDeps.now = () => new Date('2025-01-01T00:00:00Z');
}

beforeEach(() => {
  resetDeps();
});

// ── 403 "not configured" ──────────────────────────────────────────────────────

describe('GET /api/v1/boards/:boardId/specs/files — 403 not configured', () => {
  it('returns 403 with the configured-repository hint when no github_project_url is set', async () => {
    board.github_project_url = null;
    const res = await handleReadSpecsFile(makeReadRequest('specs/overview.md'), 'board-1');
    expect(res.status).toBe(403);
    const body = (await res.json()) as { name: string; data: { message: string } };
    expect(body.name).toBe('specs-not-configured');
    expect(body.data.message).toContain('configure your Github documentation');
  });
});

// ── 403 "load failed" (clone failure → 403) ───────────────────────────────────

describe('GET /api/v1/boards/:boardId/specs/files — 403 load failed', () => {
  it('returns 403 with the access-denied hint when the manifest cannot be loaded', async () => {
    specsReadDeps.downloadRepositoryFromProjectUrl = async () => {
      throw new Error('github-repository-download-failed');
    };
    const res = await handleReadSpecsFile(makeReadRequest('specs/overview.md'), 'board-1');
    expect(res.status).toBe(403);
    const body = (await res.json()) as { name: string; data: { message: string } };
    expect(body.name).toBe('specs-load-failed');
    expect(body.data.message).toContain('do not have access to this respository');
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe('GET /api/v1/boards/:boardId/specs/files — validation', () => {
  it('returns 400 when ?path= is missing', async () => {
    const req = new Request('http://localhost/api/v1/boards/board-1/specs/files');
    const res = await handleReadSpecsFile(req, 'board-1');
    expect(res.status).toBe(400);
    const body = (await res.json()) as { name: string };
    expect(body.name).toBe('missing-path');
  });
});

// ── Success ───────────────────────────────────────────────────────────────────

describe('GET /api/v1/boards/:boardId/specs/files — success', () => {
  it('returns 200 with the file content when the path is in the manifest', async () => {
    const repoPath = await createTempRepo('specs/overview.md', '# Hello World');
    specsReadDeps.downloadRepositoryFromProjectUrl = async () => ({
      repoPath,
      ref: 'main',
      fetchedAt: new Date().toISOString(),
    });
    specsReadDeps.buildSpecsManifest = async () => ({
      ref: 'main',
      fetchedAt: '2025-01-01T00:00:00Z',
      files: [{ path: 'specs/overview.md', sizeBytes: 13 }],
      etag: 'etag-file',
    });
    specsReadDeps.resolveSpecsFilePath = ({
      repoPath: rp,
      filePath,
    }: {
      repoPath: string;
      filePath: string;
    }) => ({
      ok: true as const,
      absolutePath: join(rp, filePath),
    });
    specsReadDeps.readSpecsFile = async () => ({
      content: '# Hello World',
      etag: 'etag-file-content',
    });

    const res = await handleReadSpecsFile(makeReadRequest('specs/overview.md'), 'board-1');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { path: string; content: string } };
    expect(body.data.path).toBe('specs/overview.md');
    expect(body.data.content).toBe('# Hello World');
  });
});
