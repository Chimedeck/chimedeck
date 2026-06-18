// githubProjectUrl.test.ts — unit tests for the client-side URL normaliser.
// Mirrors `server/extensions/board/mods/githubProjectUrl.test.ts` so the
// client and server stay in sync.  If the rules diverge, the parser should
// be tightened here and the server updated, not the other way around.
import { describe, expect, it } from 'vitest';
import {
  parseGithubProjectUrl,
  normalizeGithubProjectUrl,
  type GithubProjectReference,
} from '../githubProjectUrl';

const expectOk = (result: ReturnType<typeof parseGithubProjectUrl>): GithubProjectReference => {
  expect(result).not.toBeNull();
  return result as GithubProjectReference;
};

describe('parseGithubProjectUrl — project URLs', () => {
  it('accepts an org-scoped project URL and strips the trailing slash', () => {
    const ref = expectOk(
      parseGithubProjectUrl('https://github.com/orgs/JourneyHorizon/projects/42/')
    );
    expect(ref.scope).toBe('org');
    expect(ref.owner).toBe('JourneyHorizon');
    expect(ref.repository).toBeNull();
    expect(ref.projectNumber).toBe(42);
  });

  it('accepts a user-scoped project URL', () => {
    const ref = expectOk(parseGithubProjectUrl('https://github.com/users/john/projects/7'));
    expect(ref.scope).toBe('user');
    expect(ref.owner).toBe('john');
    expect(ref.projectNumber).toBe(7);
  });

  it('accepts a repo-scoped project URL and exposes the owner/repo pair', () => {
    const ref = expectOk(parseGithubProjectUrl('https://github.com/octo-org/octo-repo/projects/9'));
    expect(ref.scope).toBe('repo');
    expect(ref.owner).toBe('octo-org');
    expect(ref.repository).toBe('octo-repo');
    expect(ref.projectNumber).toBe(9);
  });
});

describe('parseGithubProjectUrl — HTTPS repository URLs', () => {
  it('accepts a plain HTTPS repo URL with the .git suffix and exposes owner/repo', () => {
    const ref = expectOk(
      parseGithubProjectUrl('https://github.com/journeyhorizon/sample-agentic-project.git')
    );
    expect(ref.scope).toBe('repo-https');
    expect(ref.owner).toBe('journeyhorizon');
    expect(ref.repository).toBe('sample-agentic-project');
    expect(ref.projectNumber).toBe(0);
  });

  it('accepts a repo URL without the .git suffix', () => {
    const ref = expectOk(
      parseGithubProjectUrl('https://github.com/journeyhorizon/sample-agentic-project')
    );
    expect(ref.repository).toBe('sample-agentic-project');
  });

  it('accepts a repo URL with a trailing slash', () => {
    const ref = expectOk(
      parseGithubProjectUrl('https://github.com/journeyhorizon/sample-agentic-project/')
    );
    expect(ref.repository).toBe('sample-agentic-project');
  });

  it('rejects a repo URL with a path that is not 2 segments', () => {
    expect(parseGithubProjectUrl('https://github.com/only-owner')).toBeNull();
  });

  it('rejects a repo URL with invalid owner characters', () => {
    expect(parseGithubProjectUrl('https://github.com/-invalid-owner/repo')).toBeNull();
  });

  it('rejects a repo URL with a reserved name like .git', () => {
    expect(parseGithubProjectUrl('https://github.com/owner/.git')).toBeNull();
  });
});

describe('parseGithubProjectUrl — SSH clone URLs', () => {
  it('accepts a git@ SSH URL with the .git suffix and exposes owner/repo', () => {
    const ref = expectOk(
      parseGithubProjectUrl('git@github.com:journeyhorizon/sample-agentic-project.git')
    );
    expect(ref.scope).toBe('repo-ssh');
    expect(ref.owner).toBe('journeyhorizon');
    expect(ref.repository).toBe('sample-agentic-project');
  });

  it('accepts a git@ SSH URL without the .git suffix', () => {
    const ref = expectOk(
      parseGithubProjectUrl('git@github.com:journeyhorizon/sample-agentic-project')
    );
    expect(ref.scope).toBe('repo-ssh');
  });

  it('rejects SSH URLs targeting a different host', () => {
    expect(parseGithubProjectUrl('git@gitlab.com:owner/repo.git')).toBeNull();
  });
});

describe('parseGithubProjectUrl — guards', () => {
  it('rejects URLs that are not github.com', () => {
    expect(parseGithubProjectUrl('https://gitlab.com/orgs/x/projects/1')).toBeNull();
  });

  it('rejects non-https URLs', () => {
    expect(parseGithubProjectUrl('http://github.com/orgs/x/projects/1')).toBeNull();
  });

  it('rejects empty input', () => {
    expect(parseGithubProjectUrl('   ')).toBeNull();
    expect(parseGithubProjectUrl('')).toBeNull();
  });

  it('rejects github.com URLs that are neither project nor repo URLs', () => {
    // Three segments (e.g. owner/repo/extra) is ambiguous.
    expect(parseGithubProjectUrl('https://github.com/owner/repo/extra')).toBeNull();
  });
});

describe('normalizeGithubProjectUrl', () => {
  it('produces identical canonical form for HTTPS and SSH inputs of the same repo', () => {
    const https = normalizeGithubProjectUrl('https://github.com/owner/repo.git');
    const ssh = normalizeGithubProjectUrl('git@github.com:owner/repo.git');
    expect(https).toBe('https://github.com/owner/repo');
    expect(https).toBe(ssh);
  });

  it('returns null for invalid input', () => {
    expect(normalizeGithubProjectUrl('not a url')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(normalizeGithubProjectUrl('')).toBeNull();
    expect(normalizeGithubProjectUrl('   ')).toBeNull();
  });

  it('keeps the project number for project URLs', () => {
    expect(normalizeGithubProjectUrl('https://github.com/orgs/owner/projects/3')).toBe(
      'https://github.com/orgs/owner/projects/3'
    );
  });
});
