// githubProjectUrl.test.ts — unit tests for the URL normaliser. Covers the
// three shapes accepted by the board "GitHub URL" setting:
//   1. Project URLs: https://github.com/(orgs|users)/<owner>/projects/<n>
//                    https://github.com/<owner>/<repo>/projects/<n>
//   2. HTTPS repo URLs:  https://github.com/<owner>/<repo>(.git)?
//   3. SSH clone URLs:   git@github.com:<owner>/<repo>(.git)?
import { describe, expect, it } from 'bun:test';

const { normalizeGithubProjectUrl, toGithubProjectAuditValue } = await import(
  '../githubProjectUrl'
);

describe('normalizeGithubProjectUrl — project URLs (existing behaviour)', () => {
  it('accepts an org-scoped project URL and strips the trailing slash', () => {
    const result = normalizeGithubProjectUrl({
      value: 'https://github.com/orgs/JourneyHorizon/projects/42/',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.normalizedUrl).toBe(
      'https://github.com/orgs/JourneyHorizon/projects/42',
    );
    expect(result.value.reference.scope).toBe('org');
    expect(result.value.reference.owner).toBe('JourneyHorizon');
    expect(result.value.reference.repository).toBeNull();
    expect(result.value.reference.projectNumber).toBe(42);
  });

  it('accepts a user-scoped project URL', () => {
    const result = normalizeGithubProjectUrl({
      value: 'https://github.com/users/john/projects/7',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.reference.scope).toBe('user');
    expect(result.value.reference.projectNumber).toBe(7);
  });

  it('accepts a repo-scoped project URL and exposes the owner/repo pair', () => {
    const result = normalizeGithubProjectUrl({
      value: 'https://github.com/octo-org/octo-repo/projects/9',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.reference.scope).toBe('repo');
    expect(result.value.reference.owner).toBe('octo-org');
    expect(result.value.reference.repository).toBe('octo-repo');
    expect(result.value.reference.projectNumber).toBe(9);
  });

  it('rejects URLs that are not github.com', () => {
    const result = normalizeGithubProjectUrl({ value: 'https://gitlab.com/orgs/x/projects/1' });
    expect(result.ok).toBe(false);
  });

  it('rejects non-https URLs', () => {
    const result = normalizeGithubProjectUrl({ value: 'http://github.com/orgs/x/projects/1' });
    expect(result.ok).toBe(false);
  });

  it('rejects github.com URLs that are neither project nor repo URLs', () => {
    // Three segments (e.g. owner/repo/extra) is ambiguous — neither a project nor a bare repo.
    const result = normalizeGithubProjectUrl({
      value: 'https://github.com/owner/repo/extra',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects empty input', () => {
    const result = normalizeGithubProjectUrl({ value: '   ' });
    expect(result.ok).toBe(false);
  });
});

describe('normalizeGithubProjectUrl — HTTPS repo URLs (new behaviour)', () => {
  it('accepts a plain HTTPS repo URL and normalises to https://github.com/owner/repo', () => {
    const result = normalizeGithubProjectUrl({
      value: 'https://github.com/journeyhorizon/sample-agentic-project.git',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.normalizedUrl).toBe(
      'https://github.com/journeyhorizon/sample-agentic-project',
    );
    expect(result.value.reference.scope).toBe('repo-https');
    expect(result.value.reference.owner).toBe('journeyhorizon');
    expect(result.value.reference.repository).toBe('sample-agentic-project');
    expect(result.value.reference.projectNumber).toBe(0);
  });

  it('accepts a repo URL without the .git suffix', () => {
    const result = normalizeGithubProjectUrl({
      value: 'https://github.com/journeyhorizon/sample-agentic-project',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.reference.repository).toBe('sample-agentic-project');
  });

  it('accepts a repo URL with a trailing slash', () => {
    const result = normalizeGithubProjectUrl({
      value: 'https://github.com/journeyhorizon/sample-agentic-project/',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.normalizedUrl).toBe(
      'https://github.com/journeyhorizon/sample-agentic-project',
    );
  });

  it('rejects a repo URL with a path that is not 2 segments', () => {
    const result = normalizeGithubProjectUrl({
      value: 'https://github.com/only-owner',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a repo URL with invalid owner characters', () => {
    const result = normalizeGithubProjectUrl({
      value: 'https://github.com/-invalid-owner/repo',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a repo URL with a reserved name like .git', () => {
    const result = normalizeGithubProjectUrl({
      value: 'https://github.com/owner/.git',
    });
    expect(result.ok).toBe(false);
  });
});

describe('normalizeGithubProjectUrl — SSH clone URLs (new behaviour)', () => {
  it('accepts a git@ SSH URL and normalises to canonical HTTPS', () => {
    const result = normalizeGithubProjectUrl({
      value: 'git@github.com:journeyhorizon/sample-agentic-project.git',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.normalizedUrl).toBe(
      'https://github.com/journeyhorizon/sample-agentic-project',
    );
    expect(result.value.reference.scope).toBe('repo-ssh');
    expect(result.value.reference.owner).toBe('journeyhorizon');
    expect(result.value.reference.repository).toBe('sample-agentic-project');
  });

  it('accepts a git@ SSH URL without the .git suffix', () => {
    const result = normalizeGithubProjectUrl({
      value: 'git@github.com:journeyhorizon/sample-agentic-project',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.reference.scope).toBe('repo-ssh');
  });

  it('rejects SSH URLs targeting a different host', () => {
    const result = normalizeGithubProjectUrl({
      value: 'git@gitlab.com:owner/repo.git',
    });
    expect(result.ok).toBe(false);
  });
});

describe('normalizeGithubProjectUrl — determinism', () => {
  it('produces identical normalisedUrl and hash for HTTPS and SSH inputs of the same repo', () => {
    const https = normalizeGithubProjectUrl({
      value: 'https://github.com/owner/repo.git',
    });
    const ssh = normalizeGithubProjectUrl({
      value: 'git@github.com:owner/repo.git',
    });
    expect(https.ok).toBe(true);
    expect(ssh.ok).toBe(true);
    if (!https.ok || !ssh.ok) return;
    expect(https.value.normalizedUrl).toBe(ssh.value.normalizedUrl);
    expect(https.value.hash).toBe(ssh.value.hash);
  });
});

describe('toGithubProjectAuditValue', () => {
  it('returns the parsed reference for a valid repo URL', () => {
    const audit = toGithubProjectAuditValue({
      url: 'https://github.com/owner/repo.git',
    });
    expect(audit.reference?.scope).toBe('repo-https');
    expect(audit.hash).not.toBeNull();
  });

  it('returns null reference and a fallback hash for invalid input', () => {
    const audit = toGithubProjectAuditValue({ url: 'not a url' });
    expect(audit.reference).toBeNull();
    expect(audit.hash).not.toBeNull();
  });

  it('returns null/null for null/undefined input', () => {
    expect(toGithubProjectAuditValue({ url: null })).toEqual({
      hash: null,
      reference: null,
    });
    expect(toGithubProjectAuditValue({ url: undefined })).toEqual({
      hash: null,
      reference: null,
    });
  });
});
