import { existsSync } from 'node:fs';
import { join } from 'node:path';
import simpleGit from 'simple-git';

function buildAuthConfig(token: string): string {
  return `http.https://github.com/.extraheader=Authorization: Bearer ${token}`;
}

function buildUserConfig(botAlias: string): string[] {
  const emailAlias = botAlias.trim();
  return [
    `user.name=${botAlias}`,
    `user.email=${emailAlias}@users.noreply.github.com`,
  ];
}

export function createGithubRepositoryGit({
  baseDir,
  token,
  botAlias,
}: {
  baseDir?: string;
  token?: string | null;
  botAlias?: string;
}) {
  const config: string[] = [];
  if (botAlias) config.push(...buildUserConfig(botAlias));
  if (token) config.push(buildAuthConfig(token));

  return simpleGit({
    ...(baseDir ? { baseDir } : {}),
    config,
  });
}

function hasRepositoryCheckout(repoPath: string): boolean {
  return existsSync(join(repoPath, '.git'));
}

export const boardGithubGitDeps = {
  hasRepositoryCheckout,
};

export async function ensureGithubRepositoryCheckout({
  repoPath,
  remoteUrl,
  ref,
  token,
}: {
  repoPath: string;
  remoteUrl: string;
  ref: string;
  token: string;
}): Promise<void> {
  try {
    if (!boardGithubGitDeps.hasRepositoryCheckout(repoPath)) {
      const git = createGithubRepositoryGit({ token });
      await git.clone(remoteUrl, repoPath, ['--branch', ref, '--single-branch', '--depth', '1']);
      return;
    }

    const git = createGithubRepositoryGit({ baseDir: repoPath, token });
    await git.raw(['remote', 'set-url', 'origin', remoteUrl]);
    await git.fetch('origin', ref, ['--depth', '1', '--prune']);
    await git.checkout(['-B', ref, `origin/${ref}`]);
  } catch {
    throw new Error('github-repository-git-operation-failed');
  }
}
