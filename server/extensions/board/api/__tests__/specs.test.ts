import { beforeEach, describe, expect, it } from 'bun:test';

// ── In-memory fixtures ─────────────────────────────────────────────────────────

type BoardRow = {
  id: string;
  workspace_id: string;
  state: 'ACTIVE' | 'ARCHIVED';
  github_project_url: string | null;
};

let board: BoardRow;
let authenticated = true;
let callerRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'GUEST' = 'MEMBER';

// Fixture manifest produced by the download+build steps.
const FAKE_REPO_PATH = '/tmp/fake-repo';
const FAKE_REF = 'main';
const FAKE_FETCHED_AT = '2026-06-03T00:00:00.000Z';
const FAKE_MANIFEST_ETAG = 'abc123def456';

const FAKE_MANIFEST = {
  ref: FAKE_REF,
  fetchedAt: FAKE_FETCHED_AT,
  files: [
    { path: 'README.md', sizeBytes: 512 },
    { path: 'docs/architecture.md', sizeBytes: 1024 },
  ],
  etag: FAKE_MANIFEST_ETAG,
};

// ── Import handlers with DI deps exposed ─────────────────────────────────────

const { handleLoadSpecsManifest, specsLoadDeps } = await import('../specs/load');
const { handleReadSpecsFile, specsReadDeps } = await import('../specs/read');

// ── Shared dep reset ──────────────────────────────────────────────────────────

function makeBoardAccessMock() {
  return async (req: Request & { board?: BoardRow }, boardId: string) => {
    if (board.id !== boardId) {
      return Response.json({ error: { code: 'board-not-found' } }, { status: 404 });
    }
    req.board = board;
    return null;
  };
}

function makeAuthMock() {
  return async (req: Request & { currentUser?: { id: string } }) => {
    if (!authenticated) {
      return Response.json({ name: 'unauthorized' }, { status: 401 });
    }
    req.currentUser = { id: 'user-1' };
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
    if (callerRank < minRank) {
      return Response.json({ name: 'insufficient-role' }, { status: 403 });
    }
    return null;
  };
}

function makeDownloadMock(repoPath = FAKE_REPO_PATH) {
  return async () => ({ repoPath, ref: FAKE_REF, fetchedAt: FAKE_FETCHED_AT });
}

function makeBuildManifestMock() {
  return async () => ({ ...FAKE_MANIFEST });
}

function makeReadFileMock(content = '# Hello World', etag = 'fileetag001') {
  return async () => ({ content, etag, sizeBytes: content.length });
}

function makeResolvePathMock(ok = true, absolutePath = `${FAKE_REPO_PATH}/README.md`) {
  return ({ filePath }: { repoPath: string; filePath: string }) => {
    if (!ok || filePath.includes('..') || filePath.startsWith('/')) {
      return { ok: false as const, reason: 'path-traversal-detected' };
    }
    return { ok: true as const, absolutePath };
  };
}

function resetDeps() {
  board = {
    id: 'board-1',
    workspace_id: 'ws-1',
    state: 'ACTIVE',
    github_project_url: 'https://github.com/orgs/journeyh/projects/12',
  };
  authenticated = true;
  callerRole = 'MEMBER';

  specsLoadDeps.authenticate = makeAuthMock();
  specsLoadDeps.requireBoardAccess = makeBoardAccessMock();
  specsLoadDeps.requireWorkspaceMembership = makeMembershipMock();
  specsLoadDeps.requireRole = makeRoleMock();
  specsLoadDeps.downloadRepositoryFromProjectUrl = makeDownloadMock();
  specsLoadDeps.buildSpecsManifest = makeBuildManifestMock();
  specsLoadDeps.now = () => new Date('2026-06-03T01:00:00.000Z');

  specsReadDeps.authenticate = makeAuthMock();
  specsReadDeps.requireBoardAccess = makeBoardAccessMock();
  specsReadDeps.requireWorkspaceMembership = makeMembershipMock();
  specsReadDeps.requireRole = makeRoleMock();
  specsReadDeps.downloadRepositoryFromProjectUrl = makeDownloadMock();
  specsReadDeps.buildSpecsManifest = makeBuildManifestMock();
  specsReadDeps.readSpecsFile = makeReadFileMock();
  specsReadDeps.resolveSpecsFilePath = makeResolvePathMock();
  specsReadDeps.now = () => new Date('2026-06-03T01:00:00.000Z');
}

beforeEach(() => {
  // Clear module-level caches between tests.
  const { specsManifestCache, specsManifestInflight, specsFileCache, specsFileInflight } =
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('../../mods/specs/cache');
  specsManifestCache.clear();
  specsManifestInflight.clear();
  specsFileCache.clear();
  specsFileInflight.clear();

  resetDeps();
});

// ── GET /api/v1/boards/:id/specs/manifest ────────────────────────────────────

describe('GET /api/v1/boards/:boardId/specs/manifest', () => {
  it('returns the manifest for an authenticated member', async () => {
    const res = await handleLoadSpecsManifest(
      new Request('http://localhost/api/v1/boards/board-1/specs/manifest'),
      'board-1',
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { data: typeof FAKE_MANIFEST };
    expect(body.data.etag).toBe(FAKE_MANIFEST_ETAG);
    expect(body.data.files).toHaveLength(2);
    expect(res.headers.get('etag')).toBe(`"${FAKE_MANIFEST_ETAG}"`);
  });

  it('returns 304 when ETag matches If-None-Match', async () => {
    const res = await handleLoadSpecsManifest(
      new Request('http://localhost/api/v1/boards/board-1/specs/manifest', {
        headers: { 'If-None-Match': `"${FAKE_MANIFEST_ETAG}"` },
      }),
      'board-1',
    );

    expect(res.status).toBe(304);
  });

  it('returns 401 for unauthenticated requests', async () => {
    authenticated = false;
    const res = await handleLoadSpecsManifest(
      new Request('http://localhost/api/v1/boards/board-1/specs/manifest'),
      'board-1',
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 for guests', async () => {
    callerRole = 'GUEST';
    const res = await handleLoadSpecsManifest(
      new Request('http://localhost/api/v1/boards/board-1/specs/manifest'),
      'board-1',
    );
    expect(res.status).toBe(403);
  });

  it('returns 422 when no github_project_url is configured', async () => {
    board.github_project_url = null;
    const res = await handleLoadSpecsManifest(
      new Request('http://localhost/api/v1/boards/board-1/specs/manifest'),
      'board-1',
    );
    expect(res.status).toBe(422);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('specs-not-configured');
  });

  it('returns 502 when the repository download fails', async () => {
    specsLoadDeps.downloadRepositoryFromProjectUrl = async () => {
      throw new Error('github-repository-download-failed');
    };

    const res = await handleLoadSpecsManifest(
      new Request('http://localhost/api/v1/boards/board-1/specs/manifest'),
      'board-1',
    );

    expect(res.status).toBe(502);
    const body = await res.json() as { name: string; data: { message: string } };
    expect(body.name).toBe('specs-load-failed');
    expect(body.data.message).toBe('github-repository-download-failed');
  });

  it('deduplicates in-flight manifest requests for the same board+url', async () => {
    let resolveTask!: () => void;
    let callCount = 0;

    specsLoadDeps.downloadRepositoryFromProjectUrl = () => {
      callCount++;
      return new Promise<{ repoPath: string; ref: string; fetchedAt: string }>((resolve) => {
        resolveTask = () => resolve({ repoPath: FAKE_REPO_PATH, ref: FAKE_REF, fetchedAt: FAKE_FETCHED_AT });
      });
    };

    // Fire two concurrent requests — only one download should be triggered.
    const p1 = handleLoadSpecsManifest(
      new Request('http://localhost/api/v1/boards/board-1/specs/manifest'),
      'board-1',
    );
    const p2 = handleLoadSpecsManifest(
      new Request('http://localhost/api/v1/boards/board-1/specs/manifest'),
      'board-1',
    );

    // Flush microtasks so both handlers reach the downloadRepositoryFromProjectUrl call.
    await new Promise((r) => setTimeout(r, 0));

    resolveTask();
    await Promise.all([p1, p2]);

    expect(callCount).toBe(1);
  });
});

// ── GET /api/v1/boards/:id/specs/files?path=... ───────────────────────────────

describe('GET /api/v1/boards/:boardId/specs/files', () => {
  it('returns file content for a valid manifest path', async () => {
    const res = await handleReadSpecsFile(
      new Request('http://localhost/api/v1/boards/board-1/specs/files?path=README.md'),
      'board-1',
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { path: string; content: string } };
    expect(body.data.path).toBe('README.md');
    expect(body.data.content).toBe('# Hello World');
    expect(res.headers.get('etag')).toBe('"fileetag001"');
  });

  it('returns 304 when file ETag matches If-None-Match', async () => {
    const res = await handleReadSpecsFile(
      new Request('http://localhost/api/v1/boards/board-1/specs/files?path=README.md', {
        headers: { 'If-None-Match': '"fileetag001"' },
      }),
      'board-1',
    );
    expect(res.status).toBe(304);
  });

  it('returns 400 when path query param is missing', async () => {
    const res = await handleReadSpecsFile(
      new Request('http://localhost/api/v1/boards/board-1/specs/files'),
      'board-1',
    );
    expect(res.status).toBe(400);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('missing-path');
  });

  it('rejects path traversal attempts (..)', async () => {
    specsReadDeps.resolveSpecsFilePath = makeResolvePathMock(false);

    const res = await handleReadSpecsFile(
      new Request('http://localhost/api/v1/boards/board-1/specs/files?path=../../../etc/passwd'),
      'board-1',
    );
    expect(res.status).toBe(400);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('path-traversal-rejected');
  });

  it('returns 404 for a path not in the manifest', async () => {
    const res = await handleReadSpecsFile(
      new Request('http://localhost/api/v1/boards/board-1/specs/files?path=secret.md'),
      'board-1',
    );
    expect(res.status).toBe(404);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('specs-file-not-found');
  });

  it('returns 422 when the manifest-listed size exceeds the limit', async () => {
    // Override manifest to include a file that exceeds the 1MiB limit.
    specsReadDeps.buildSpecsManifest = async () => ({
      ref: FAKE_REF,
      fetchedAt: FAKE_FETCHED_AT,
      files: [{ path: 'README.md', sizeBytes: 2 * 1024 * 1024 }],
      etag: FAKE_MANIFEST_ETAG,
    });

    const res = await handleReadSpecsFile(
      new Request('http://localhost/api/v1/boards/board-1/specs/files?path=README.md'),
      'board-1',
    );
    expect(res.status).toBe(422);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('specs-file-too-large');
  });

  it('returns 401 for unauthenticated requests', async () => {
    authenticated = false;
    const res = await handleReadSpecsFile(
      new Request('http://localhost/api/v1/boards/board-1/specs/files?path=README.md'),
      'board-1',
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 for guests', async () => {
    callerRole = 'GUEST';
    const res = await handleReadSpecsFile(
      new Request('http://localhost/api/v1/boards/board-1/specs/files?path=README.md'),
      'board-1',
    );
    expect(res.status).toBe(403);
  });

  it('returns 422 when no github_project_url is configured', async () => {
    board.github_project_url = null;
    const res = await handleReadSpecsFile(
      new Request('http://localhost/api/v1/boards/board-1/specs/files?path=README.md'),
      'board-1',
    );
    expect(res.status).toBe(422);
  });

  it('returns 502 when the repository download fails', async () => {
    specsReadDeps.downloadRepositoryFromProjectUrl = async () => {
      throw new Error('github-repository-download-failed');
    };
    const res = await handleReadSpecsFile(
      new Request('http://localhost/api/v1/boards/board-1/specs/files?path=README.md'),
      'board-1',
    );
    expect(res.status).toBe(502);
  });
});
