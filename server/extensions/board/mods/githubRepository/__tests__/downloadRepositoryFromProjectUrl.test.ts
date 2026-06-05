import { beforeEach, describe, expect, it } from 'bun:test';

const module = await import('../downloadRepositoryFromProjectUrl');
const {
  downloadRepositoryFromProjectUrl,
  downloadRepositoryFromProjectUrlDeps,
} = module;

let nowMs = Date.parse('2026-06-03T12:00:00.000Z');
let mkdirCalls: Array<{ path: string; recursive: boolean }>;
let tokenCalls = 0;
let branchCalls = 0;
let checkoutCalls: Array<{ repoPath: string; remoteUrl: string; ref: string; token: string }>;

beforeEach(() => {
  nowMs = Date.parse('2026-06-03T12:00:00.000Z');
  mkdirCalls = [];
  tokenCalls = 0;
  branchCalls = 0;
  checkoutCalls = [];

  downloadRepositoryFromProjectUrlDeps.now = () => new Date(nowMs);
  downloadRepositoryFromProjectUrlDeps.mkdir = async (path, options) => {
    mkdirCalls.push({
      path: String(path),
      recursive: typeof options === 'object' && options !== null && options.recursive === true,
    });
  };
  downloadRepositoryFromProjectUrlDeps.getGithubInstallationAccessToken = async () => {
    tokenCalls += 1;
    return 'ghs_test_installation_token';
  };
  downloadRepositoryFromProjectUrlDeps.getGithubRepositoryDefaultBranch = async () => {
    branchCalls += 1;
    return 'main';
  };
  downloadRepositoryFromProjectUrlDeps.ensureGithubRepositoryCheckout = async (input) => {
    checkoutCalls.push(input);
  };
});

describe('downloadRepositoryFromProjectUrl', () => {
  it('downloads repository scope project URLs and returns repository metadata', async () => {
    const result = await downloadRepositoryFromProjectUrl({
      projectUrl: 'https://github.com/octo-org/octo-repo/projects/7',
      boardId: 'board-download',
    });

    expect(result.ref).toBe('main');
    expect(result.repoPath).toContain('/board-download/');
    expect(result.repoPath.endsWith('/repository')).toBe(true);
    expect(tokenCalls).toBe(1);
    expect(branchCalls).toBe(1);
    expect(checkoutCalls).toHaveLength(1);
    expect(checkoutCalls[0]?.remoteUrl).toBe('https://github.com/octo-org/octo-repo.git');
    expect(checkoutCalls[0]?.token).toBe('ghs_test_installation_token');
    expect(mkdirCalls).toHaveLength(1);
  });

  it('reuses cache entries for repeated calls inside cache TTL', async () => {
    const input = {
      projectUrl: 'https://github.com/octo-org/octo-repo/projects/8',
      boardId: 'board-cache',
    };

    const first = await downloadRepositoryFromProjectUrl(input);
    nowMs += 10_000;
    const second = await downloadRepositoryFromProjectUrl(input);

    expect(second).toEqual(first);
    expect(tokenCalls).toBe(1);
    expect(branchCalls).toBe(1);
    expect(checkoutCalls).toHaveLength(1);
  });

  it('refreshes repository checkout when refresh=true', async () => {
    const input = {
      projectUrl: 'https://github.com/octo-org/octo-repo/projects/9',
      boardId: 'board-refresh',
    };

    await downloadRepositoryFromProjectUrl(input);
    nowMs += 10_000;
    await downloadRepositoryFromProjectUrl({ ...input, refresh: true });

    expect(tokenCalls).toBe(2);
    expect(branchCalls).toBe(2);
    expect(checkoutCalls).toHaveLength(2);
  });

  it('rejects invalid URLs before any network/git work', async () => {
    await expect(downloadRepositoryFromProjectUrl({
      // Three-segment path is ambiguous — neither a project nor a bare repo.
      projectUrl: 'https://github.com/octo-org/not-a-project/extra',
      boardId: 'board-invalid',
    })).rejects.toThrow('invalid-github-project-url');

    expect(tokenCalls).toBe(0);
    expect(branchCalls).toBe(0);
    expect(checkoutCalls).toHaveLength(0);
  });

  it('rejects non-repository project URLs because repository target is ambiguous', async () => {
    await expect(downloadRepositoryFromProjectUrl({
      projectUrl: 'https://github.com/orgs/octo-org/projects/42',
      boardId: 'board-org-project',
    })).rejects.toThrow('github-project-url-repository-scope-required');

    expect(tokenCalls).toBe(0);
    expect(branchCalls).toBe(0);
    expect(checkoutCalls).toHaveLength(0);
  });

  it('accepts a plain HTTPS repository URL and downloads it', async () => {
    const result = await downloadRepositoryFromProjectUrl({
      projectUrl: 'https://github.com/octo-org/octo-repo.git',
      boardId: 'board-https-repo',
    });

    expect(result.ref).toBe('main');
    expect(checkoutCalls[0]?.remoteUrl).toBe('https://github.com/octo-org/octo-repo.git');
    expect(tokenCalls).toBe(1);
  });

  it('accepts an SSH clone URL and downloads it', async () => {
    const result = await downloadRepositoryFromProjectUrl({
      projectUrl: 'git@github.com:octo-org/octo-repo.git',
      boardId: 'board-ssh-repo',
    });

    expect(result.ref).toBe('main');
    expect(checkoutCalls[0]?.remoteUrl).toBe('https://github.com/octo-org/octo-repo.git');
    expect(tokenCalls).toBe(1);
  });

  it('does not expose installation tokens in thrown errors', async () => {
    downloadRepositoryFromProjectUrlDeps.ensureGithubRepositoryCheckout = async () => {
      throw new Error('git failed with token ghs_test_installation_token');
    };

    await expect(downloadRepositoryFromProjectUrl({
      projectUrl: 'https://github.com/octo-org/octo-repo/projects/10',
      boardId: 'board-token-safety',
    })).rejects.toThrow('github-repository-download-failed');

    try {
      await downloadRepositoryFromProjectUrl({
        projectUrl: 'https://github.com/octo-org/octo-repo/projects/10',
        boardId: 'board-token-safety',
        refresh: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message.includes('ghs_test_installation_token')).toBe(false);
    }
  });
});
