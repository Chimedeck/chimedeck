// Focused tests for PUT /api/v1/boards/:boardId/github/specs/file
// These cover RBAC, stale-precondition, and validation cases not exhaustively
// tested in the combined specs.test.ts.
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
let guestType: 'MEMBER' | 'VIEWER' | undefined = undefined;

const { handlePutSpecsFile, specsFileWriteDeps } = await import('../file');

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
  return async (req: Request & { callerRole?: string; guestType?: string; workspaceId?: string }, workspaceId: string) => {
    req.workspaceId = workspaceId;
    req.callerRole = callerRole;
    if (guestType !== undefined) req.guestType = guestType;
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

async function createTempRepo(fileName = 'specs/guide.md', content = '# Hello World') {
  const repoPath = await mkdtemp(join(tmpdir(), 'save-test-'));
  await mkdir(join(repoPath, 'specs'), { recursive: true });
  await writeFile(join(repoPath, fileName), content);
  return repoPath;
}

function makeSaveRequest(
  path: string,
  content: string,
  ifMatch: string | null = '"etag-v1"',
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ifMatch !== null) headers['If-Match'] = ifMatch;
  return new Request('http://localhost/api/v1/boards/board-1/github/specs/file', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ path, content }),
  });
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
  guestType = undefined;

  specsFileWriteDeps.authenticate = makeAuthMock();
  specsFileWriteDeps.requireBoardAccess = makeBoardAccessMock();
  specsFileWriteDeps.requireWorkspaceMembership = makeMembershipMock();
  specsFileWriteDeps.requireRole = makeRoleMock();
  specsFileWriteDeps.writeSpecsFile = async ({ repoPath, filePath, content, ifMatch }) => {
    const { writeSpecsFile } = await import('../../../mods/specs/write');
    return writeSpecsFile({ repoPath, filePath, content, ifMatch });
  };
  specsFileWriteDeps.invalidateSpecsCachesForBoard = () => {};
}

beforeEach(() => { resetDeps(); });

// ── Authorization ─────────────────────────────────────────────────────────────

describe('PUT /api/v1/boards/:boardId/github/specs/file — authorization', () => {
  it('returns 401 for unauthenticated requests', async () => {
    authenticated = false;
    const res = await handlePutSpecsFile(makeSaveRequest('specs/guide.md', '# Edited'), 'board-1');
    expect(res.status).toBe(401);
  });

  it('returns 403 for VIEWER role', async () => {
    callerRole = 'VIEWER';
    const res = await handlePutSpecsFile(makeSaveRequest('specs/guide.md', '# Edited'), 'board-1');
    expect(res.status).toBe(403);
  });

  it('returns 403 for GUEST VIEWER (guestType=VIEWER)', async () => {
    callerRole = 'GUEST';
    guestType = 'VIEWER';
    const res = await handlePutSpecsFile(makeSaveRequest('specs/guide.md', '# Edited'), 'board-1');
    expect(res.status).toBe(403);
    const body = await res.json() as { name: string };
    expect(body.name).toContain('guest');
  });

  it('allows GUEST MEMBER (guestType=MEMBER) to save', async () => {
    callerRole = 'GUEST';
    guestType = 'MEMBER';
    const repoPath = await createTempRepo('specs/guide.md', '# Hello World');
    specsFileWriteDeps.downloadRepositoryFromProjectUrl = async () => ({
      repoPath,
      ref: 'main',
      fetchedAt: new Date().toISOString(),
    });
    specsFileWriteDeps.writeSpecsFile = async () => ({ sha: 'sha-abc', etag: '"etag-v2"', created: false });

    const res = await handlePutSpecsFile(
      makeSaveRequest('specs/guide.md', '# Edited', null),
      'board-1',
    );
    // null If-Match is fine for a new create (file doesn't have an etag yet)
    expect([200, 201]).toContain(res.status);
  });

  it('returns 403 with the configured-repository hint when no github_project_url is set', async () => {
    board.github_project_url = null;
    const res = await handlePutSpecsFile(makeSaveRequest('specs/guide.md', '# Edited'), 'board-1');
    expect(res.status).toBe(403);
    const body = await res.json() as { name: string; data: { message: string } };
    expect(body.name).toBe('specs-not-configured');
    expect(body.data.message).toContain('configure your Github documentation');
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe('PUT /api/v1/boards/:boardId/github/specs/file — validation', () => {
  it('returns 422 for non-markdown paths', async () => {
    const repoPath = await createTempRepo();
    specsFileWriteDeps.downloadRepositoryFromProjectUrl = async () => ({
      repoPath,
      ref: 'main',
      fetchedAt: new Date().toISOString(),
    });
    specsFileWriteDeps.writeSpecsFile = async () => {
      throw new Error('specs-file-must-be-markdown');
    };

    const res = await handlePutSpecsFile(
      makeSaveRequest('specs/guide.js', 'const x = 1;'),
      'board-1',
    );
    expect(res.status).toBe(422);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('specs-file-must-be-markdown');
  });

  it('returns 400 for path traversal attempts', async () => {
    const repoPath = await createTempRepo();
    specsFileWriteDeps.downloadRepositoryFromProjectUrl = async () => ({
      repoPath,
      ref: 'main',
      fetchedAt: new Date().toISOString(),
    });
    specsFileWriteDeps.writeSpecsFile = async () => {
      throw new Error('path-traversal-detected');
    };

    const res = await handlePutSpecsFile(
      makeSaveRequest('../etc/passwd', '# Hacked'),
      'board-1',
    );
    expect(res.status).toBe(400);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('path-traversal-detected');
  });
});

// ── Stale-precondition (If-Match) ─────────────────────────────────────────────

describe('PUT /api/v1/boards/:boardId/github/specs/file — stale precondition', () => {
  it('returns 412 when the If-Match header is stale', async () => {
    const repoPath = await createTempRepo('specs/guide.md', '# Hello World');
    // Simulate an existing etag by writing a file the write module can check.
    specsFileWriteDeps.downloadRepositoryFromProjectUrl = async () => ({
      repoPath,
      ref: 'main',
      fetchedAt: new Date().toISOString(),
    });
    specsFileWriteDeps.writeSpecsFile = async () => {
      throw new Error('stale-specs-file-precondition');
    };

    const res = await handlePutSpecsFile(
      makeSaveRequest('specs/guide.md', '# Edited', '"stale-etag"'),
      'board-1',
    );
    expect(res.status).toBe(412);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('stale-specs-file-precondition');
  });

  it('returns 412 when If-Match is missing for an update', async () => {
    const repoPath = await createTempRepo();
    specsFileWriteDeps.downloadRepositoryFromProjectUrl = async () => ({
      repoPath,
      ref: 'main',
      fetchedAt: new Date().toISOString(),
    });
    specsFileWriteDeps.writeSpecsFile = async () => {
      throw new Error('missing-specs-file-precondition');
    };

    const res = await handlePutSpecsFile(
      makeSaveRequest('specs/guide.md', '# Edited', null),
      'board-1',
    );
    expect(res.status).toBe(412);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('missing-specs-file-precondition');
  });
});
