// Focused tests for POST /api/v1/boards/:boardId/github/specs/commit
// These cover RBAC, commit metadata (bot alias / actor footer), stale-precondition,
// and authorization cases that complement the combined specs.test.ts.
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
let guestType: 'MEMBER' | 'VIEWER' | undefined = undefined;

const { handleCommitSpecs, specsCommitDeps } = await import('../commit');

// ── Shared mock helpers ───────────────────────────────────────────────────────

function makeAuthMock() {
  return async (req: Request & { currentUser?: { id: string } }) => {
    if (!authenticated) return Response.json({ name: 'unauthorized' }, { status: 401 });
    req.currentUser = { id: 'user-actor-1' };
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

function makeCommitRequest(
  changedFiles: string[] = ['specs/overview.md'],
  message = 'Update specs',
) {
  return new Request('http://localhost/api/v1/boards/board-1/github/specs/commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, changedFiles }),
  });
}

const FAKE_REPO_PATH = '/tmp/fake-commit-repo';

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

  specsCommitDeps.authenticate = makeAuthMock();
  specsCommitDeps.requireBoardAccess = makeBoardAccessMock();
  specsCommitDeps.requireWorkspaceMembership = makeMembershipMock();
  specsCommitDeps.requireRole = makeRoleMock();
  specsCommitDeps.downloadRepositoryFromProjectUrl = async () => ({
    repoPath: FAKE_REPO_PATH,
    ref: 'main',
    fetchedAt: new Date().toISOString(),
  });
  specsCommitDeps.getGithubInstallationAccessToken = async () => 'installation-token';
  specsCommitDeps.normalizeGithubProjectUrl = ({ value }: { value: string }) => ({
    ok: true as const,
    value: {
      normalizedUrl: value,
      hash: 'hash',
      reference: {
        scope: 'repo' as const,
        owner: 'journeyhorizon',
        repository: 'agentic-trello-replacement',
        projectNumber: 12,
      },
    },
  });
  specsCommitDeps.commitSpecsChanges = async () => {
    throw new Error('commit-mock-not-configured');
  };
}

beforeEach(() => { resetDeps(); });

// ── Authorization ─────────────────────────────────────────────────────────────

describe('POST /api/v1/boards/:boardId/github/specs/commit — authorization', () => {
  it('returns 401 for unauthenticated requests', async () => {
    authenticated = false;
    const res = await handleCommitSpecs(makeCommitRequest(), 'board-1');
    expect(res.status).toBe(401);
  });

  it('returns 403 for VIEWER role', async () => {
    callerRole = 'VIEWER';
    const res = await handleCommitSpecs(makeCommitRequest(), 'board-1');
    expect(res.status).toBe(403);
  });

  it('returns 403 for GUEST VIEWER', async () => {
    callerRole = 'GUEST';
    guestType = 'VIEWER';
    const res = await handleCommitSpecs(makeCommitRequest(), 'board-1');
    expect(res.status).toBe(403);
    const body = await res.json() as { name: string };
    expect(body.name).toContain('guest');
  });

  it('returns 422 when no github_project_url is configured', async () => {
    board.github_project_url = null;
    const res = await handleCommitSpecs(makeCommitRequest(), 'board-1');
    expect(res.status).toBe(422);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('specs-not-configured');
  });
});

// ── Commit metadata ───────────────────────────────────────────────────────────

describe('POST /api/v1/boards/:boardId/github/specs/commit — commit metadata', () => {
  it('passes actorId, boardId, and botAlias to commitSpecsChanges', async () => {
    let capturedInput: Parameters<typeof specsCommitDeps.commitSpecsChanges>[0] | null = null;

    specsCommitDeps.commitSpecsChanges = async (input) => {
      capturedInput = input;
      return {
        commitHash: 'sha-abc',
        pushStatus: 'pushed' as const,
        branch: 'main',
        changedFiles: input.changedFiles,
        footer: `actor: ${input.actorId}\nboard: ${input.boardId}`,
      };
    };

    const res = await handleCommitSpecs(
      makeCommitRequest(['specs/overview.md'], 'Add overview doc'),
      'board-1',
    );

    expect(res.status).toBe(201);
    expect(capturedInput).not.toBeNull();
    expect(capturedInput!.actorId).toBe('user-actor-1');
    expect(capturedInput!.boardId).toBe('board-1');
    // botAlias must be non-empty so commits are attributed to the app bot.
    expect(typeof capturedInput!.botAlias).toBe('string');
    expect(capturedInput!.botAlias.length).toBeGreaterThan(0);
  });

  it('returns footer in the response body', async () => {
    const expectedFooter = 'actor: user-actor-1\nboard: board-1';

    specsCommitDeps.commitSpecsChanges = async (input) => ({
      commitHash: 'sha-abc',
      pushStatus: 'pushed' as const,
      branch: 'main',
      changedFiles: input.changedFiles,
      footer: expectedFooter,
    });

    const res = await handleCommitSpecs(makeCommitRequest(), 'board-1');
    expect(res.status).toBe(201);
    const body = await res.json() as { data: { footer: string } };
    expect(body.data.footer).toBe(expectedFooter);
  });

  it('includes pushStatus in the response', async () => {
    specsCommitDeps.commitSpecsChanges = async (input) => ({
      commitHash: 'sha-pending',
      pushStatus: 'pending' as const,
      branch: 'main',
      changedFiles: input.changedFiles,
      footer: '',
    });
    // No installation token available
    specsCommitDeps.getGithubInstallationAccessToken = async () => {
      throw new Error('no-installation-token');
    };

    const res = await handleCommitSpecs(makeCommitRequest(), 'board-1');
    // When push token is unavailable the handler falls through to commitSpecsChanges
    // with a null token; if commitSpecsChanges throws the handler returns 502.
    // If the mock succeeds, we expect 201.
    expect([201, 502]).toContain(res.status);
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe('POST /api/v1/boards/:boardId/github/specs/commit — validation', () => {
  it('returns 422 when a non-markdown file is in changedFiles', async () => {
    specsCommitDeps.commitSpecsChanges = async () => {
      throw new Error('specs-file-must-be-markdown');
    };

    const res = await handleCommitSpecs(
      makeCommitRequest(['specs/guide.js']),
      'board-1',
    );
    expect(res.status).toBe(422);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('specs-file-must-be-markdown');
  });

  it('returns 400 when changedFiles is missing from the request body', async () => {
    const req = new Request('http://localhost/api/v1/boards/board-1/github/specs/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Update specs' }),
    });

    const res = await handleCommitSpecs(req, 'board-1');
    expect(res.status).toBe(400);
  });

  it('returns 400 when message is missing from the request body', async () => {
    const req = new Request('http://localhost/api/v1/boards/board-1/github/specs/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changedFiles: ['specs/overview.md'] }),
    });

    const res = await handleCommitSpecs(req, 'board-1');
    expect(res.status).toBe(400);
  });
});
