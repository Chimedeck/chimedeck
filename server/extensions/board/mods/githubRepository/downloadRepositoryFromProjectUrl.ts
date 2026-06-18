import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { githubRepositoryConfig } from '../../common/config/githubRepository';
import { normalizeGithubProjectUrl } from '../githubProjectUrl';
import { getGithubInstallationAccessToken, getGithubRepositoryDefaultBranch } from './githubApp';
import { ensureGithubRepositoryCheckout } from './git';

export interface DownloadRepositoryFromProjectUrlInput {
  projectUrl: string;
  boardId?: string;
  refresh?: boolean;
}

export interface DownloadRepositoryFromProjectUrlResult {
  repoPath: string;
  ref: string;
  fetchedAt: string;
}

interface RepositoryCacheEntry extends DownloadRepositoryFromProjectUrlResult {
  cachedAtMs: number;
}

const repositoryCache = new Map<string, RepositoryCacheEntry>();
const inFlightDownloads = new Map<string, Promise<DownloadRepositoryFromProjectUrlResult>>();

function toKeyHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function toCacheKey({ boardId, projectHash }: { boardId: string; projectHash: string }): string {
  return toKeyHash(`${boardId}:${projectHash}`);
}

function getCachedRepository({
  cacheKey,
}: {
  cacheKey: string;
}): DownloadRepositoryFromProjectUrlResult | null {
  const cached = repositoryCache.get(cacheKey);
  if (!cached) return null;
  const nowMs = downloadRepositoryFromProjectUrlDeps.now().getTime();
  if (
    nowMs - cached.cachedAtMs >
    downloadRepositoryFromProjectUrlDeps.config.repositoryCacheTtlMs
  ) {
    repositoryCache.delete(cacheKey);
    return null;
  }
  return {
    repoPath: cached.repoPath,
    ref: cached.ref,
    fetchedAt: cached.fetchedAt,
  };
}

function cacheRepository({
  cacheKey,
  value,
}: {
  cacheKey: string;
  value: DownloadRepositoryFromProjectUrlResult;
}): void {
  repositoryCache.set(cacheKey, {
    ...value,
    cachedAtMs: downloadRepositoryFromProjectUrlDeps.now().getTime(),
  });
}

export const downloadRepositoryFromProjectUrlDeps = {
  now: () => new Date(),
  mkdir,
  normalizeGithubProjectUrl,
  getGithubInstallationAccessToken,
  getGithubRepositoryDefaultBranch,
  ensureGithubRepositoryCheckout,
  config: githubRepositoryConfig,
};

async function downloadRepositoryForKey({
  cacheKey,
  projectUrl,
  refresh,
  boardId,
}: {
  cacheKey: string;
  projectUrl: string;
  refresh: boolean;
  boardId: string;
}): Promise<DownloadRepositoryFromProjectUrlResult> {
  if (!refresh) {
    const cached = getCachedRepository({ cacheKey });
    if (cached) return cached;
  }

  const normalized = downloadRepositoryFromProjectUrlDeps.normalizeGithubProjectUrl({
    value: projectUrl,
  });
  if (!normalized.ok) {
    throw new Error('invalid-github-project-url');
  }
  const { reference } = normalized.value;
  // [why] Repo download requires a concrete owner/repo pair. Accept the three
  // shapes that produce one: project linked to a repo, plain HTTPS repo URL,
  // and SSH clone URL.
  const isRepoShape =
    (reference.scope === 'repo' ||
      reference.scope === 'repo-https' ||
      reference.scope === 'repo-ssh') &&
    Boolean(reference.repository);
  if (!isRepoShape) {
    throw new Error('github-project-url-repository-scope-required');
  }

  const installationToken =
    await downloadRepositoryFromProjectUrlDeps.getGithubInstallationAccessToken({
      reference,
    });
  const ref = await downloadRepositoryFromProjectUrlDeps.getGithubRepositoryDefaultBranch({
    owner: reference.owner,
    repository: reference.repository,
    token: installationToken,
  });
  const repoPath = join(
    downloadRepositoryFromProjectUrlDeps.config.repositoryCacheDir,
    boardId,
    cacheKey,
    'repository'
  );
  const repoParentPath = join(
    downloadRepositoryFromProjectUrlDeps.config.repositoryCacheDir,
    boardId,
    cacheKey
  );
  await downloadRepositoryFromProjectUrlDeps.mkdir(repoParentPath, { recursive: true });

  try {
    await downloadRepositoryFromProjectUrlDeps.ensureGithubRepositoryCheckout({
      repoPath,
      remoteUrl: `https://github.com/${reference.owner}/${reference.repository}.git`,
      ref,
      token: installationToken,
    });
  } catch {
    throw new Error('github-repository-download-failed');
  }

  const value = {
    repoPath,
    ref,
    fetchedAt: downloadRepositoryFromProjectUrlDeps.now().toISOString(),
  };
  cacheRepository({ cacheKey, value });
  return value;
}

export async function downloadRepositoryFromProjectUrl({
  projectUrl,
  boardId = 'global',
  refresh = false,
}: DownloadRepositoryFromProjectUrlInput): Promise<DownloadRepositoryFromProjectUrlResult> {
  const normalized = downloadRepositoryFromProjectUrlDeps.normalizeGithubProjectUrl({
    value: projectUrl,
  });
  if (!normalized.ok) {
    throw new Error('invalid-github-project-url');
  }
  const cacheKey = toCacheKey({
    boardId,
    projectHash: normalized.value.hash,
  });

  const inFlight = inFlightDownloads.get(cacheKey);
  if (inFlight) return inFlight;

  const task = downloadRepositoryForKey({
    cacheKey,
    projectUrl,
    boardId,
    refresh,
  }).finally(() => {
    inFlightDownloads.delete(cacheKey);
  });
  inFlightDownloads.set(cacheKey, task);
  return task;
}
