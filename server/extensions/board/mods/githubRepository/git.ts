import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import simpleGit from 'simple-git';

function isMissingRemoteBranchError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /remote branch .* not found|couldn't find remote ref|could not find remote branch|is not a commit and a branch .* cannot be created from it/i.test(message);
}

function buildAuthConfig(token: string): string {
  const basicAuth = Buffer.from(`x-access-token:${token}`).toString('base64');
  return `http.https://github.com/.extraheader=Authorization: Basic ${basicAuth}`;
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

async function removeRepositoryCheckout(repoPath: string): Promise<void> {
  await rm(repoPath, { recursive: true, force: true });
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
  if (!boardGithubGitDeps.hasRepositoryCheckout(repoPath)) {
    const git = createGithubRepositoryGit({ token });
    try {
      await git.clone(remoteUrl, repoPath, ['--branch', ref, '--single-branch', '--depth', '1']);
    } catch (err) {
      if (!isMissingRemoteBranchError(err)) throw err;
      // [why] Some repositories expose a default branch that differs from the
      // GitHub API's reported default_branch. If the requested ref is absent,
      // fall back to cloning the repository HEAD so specs loading can still
      // proceed.
      await removeRepositoryCheckout(repoPath);
      await git.clone(remoteUrl, repoPath, ['--depth', '1']);
    }
    return;
}

  const git = createGithubRepositoryGit({ baseDir: repoPath, token });
  try {
    await git.raw(['remote', 'set-url', 'origin', remoteUrl]);
    await git.fetch('origin', ref, ['--depth', '1', '--prune']);
    await git.checkout(['-B', ref, `origin/${ref}`]);
  } catch (err) {
    if (!isMissingRemoteBranchError(err)) throw err;
    // [why] If the cached checkout was created with a branch that no longer
    // exists, drop the partial checkout and reclone the repository HEAD.
    await removeRepositoryCheckout(repoPath);
    const fallbackGit = createGithubRepositoryGit({ token });
    await fallbackGit.clone(remoteUrl, repoPath, ['--depth', '1']);
  }
}
