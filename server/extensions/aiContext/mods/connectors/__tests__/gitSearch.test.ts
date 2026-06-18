// Tests for gitSearch connector — git history parsing and scoring.
import { describe, it, expect } from 'vitest';
import { searchGit, type GitOps } from '../gitSearch';

describe('searchGit', () => {
  it('returns empty array when git is not available (non-zero exit)', async () => {
    const mockGit: GitOps = {
      log: async () => ({ stdout: '', exitCode: 128 }),
    };

    const results = await searchGit({
      repoRoot: '/fake/repo',
      intent: 'anything',
      git: mockGit,
    });

    expect(results).toEqual([]);
  });

  it('parses git log output and scores by intent', async () => {
    const commitData =
      'abc1234\nfeat(auth): implement JWT authentication\nsrc/auth/index.ts\n---\ndef5678\nchore(deps): update dependencies\npackage.json\n';

    const mockGit: GitOps = {
      log: async () => ({ stdout: commitData, exitCode: 0 }),
    };

    const results = await searchGit({
      repoRoot: '/fake/repo',
      intent: 'authentication JWT',
      git: mockGit,
    });

    // [why] At least one commit should match authentication keywords.
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source).toBe('git');
    expect(results[0].content).toContain('abc1234');
    expect(results[0].content).toContain('JWT authentication');
  });

  it('gracefully handles spawn errors', async () => {
    const mockGit: GitOps = {
      log: async () => {
        throw new Error('spawn ENOTDIR');
      },
    };

    const results = await searchGit({
      repoRoot: '/invalid/path',
      intent: 'anything',
      git: mockGit,
    });

    // [why] Errors should be caught and return empty — never throw.
    expect(results).toEqual([]);
  });

  it('limits files listed in content', async () => {
    const manyFiles = Array.from({ length: 30 }, (_, i) => `file${i}.ts`);
    const commitEntry = ['hash123', 'feat: many files changed', ...manyFiles];
    // [why] Git log entries are separated by a blank line then separator line
    const raw = `${commitEntry.join('\n')}\n`;

    const mockGit: GitOps = {
      log: async () => ({ stdout: raw, exitCode: 0 }),
    };

    const results = await searchGit({
      repoRoot: '/fake/repo',
      intent: 'files changed',
      git: mockGit,
    });

    // [why] Should find at least one match.
    expect(results.length).toBeGreaterThan(0);
    // [why] Files should be truncated in display with "+ N more" suffix.
    expect(results[0].content).toContain('(+');
  });
});
