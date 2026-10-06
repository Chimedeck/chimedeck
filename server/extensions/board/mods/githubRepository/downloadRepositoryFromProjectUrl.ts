import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { githubRepositoryConfig } from '../../common/config/githubRepository';
import { normalizeGithubProjectUrl } from '../githubProjectUrl';
import { getGithubInstallationAccessToken, getGithubRepositoryDefaultBranch } from './githubApp';
import { ensureGithubRepositoryCheckout, removeRepositoryCheckout } from './git';

export interface DownloadRepositoryFromProjectUrlInput {
  projectUrl: string;
  boardId?: string;
  refresh?: boolean;
  /** [why] When set, this branch is used for checkout instead of the repo's
   * default branch from the GitHub API. Allows boards to target a specific
   * branch (e.g. "develop", "feature/foo") for specs work. */
  branch?: string | null | undefined;
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
  removeRepositoryCheckout,
  config: githubRepositoryConfig,
};

async function downloadRepositoryForKey({
  cacheKey,
  projectUrl,
  refresh,
  boardId,
  branch,
}: {
  cacheKey: string;
  projectUrl: string;
  refresh: boolean;
  boardId: string;
  branch?: string | null | undefined;
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

  // [why] After the isRepoShape guard, repository is guaranteed non-null.
  // Extract to a local so TypeScript narrows the type for downstream use.
  const repository = reference.repository!;
  const owner = reference.owner;

  const installationToken =
    await downloadRepositoryFromProjectUrlDeps.getGithubInstallationAccessToken({
      reference,
    });

  // [why] When the board has a custom branch configured, use it instead of the
  // repo's default branch. Falls back to the GitHub API default_branch when
  // no custom branch is set.
  const defaultRef = await downloadRepositoryFromProjectUrlDeps.getGithubRepositoryDefaultBranch({
    owner,
    repository,
    token: installationToken,
  });
  const ref = branch && branch.trim().length > 0 ? branch.trim() : defaultRef;

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

  // [why] When refresh=true, delete any existing checkout so we force a fresh clone
  // from GitHub instead of just doing a git fetch on the cached checkout.
  if (refresh) {
    await downloadRepositoryFromProjectUrlDeps.removeRepositoryCheckout(repoPath);
  }

  try {
    await downloadRepositoryFromProjectUrlDeps.ensureGithubRepositoryCheckout({
      repoPath,
      remoteUrl: `https://github.com/${owner}/${repository}.git`,
      ref,
      token: installationToken,
    });
  } catch (e) {
    console.error(
      `Failed to download GitHub repository for board ${boardId} from ${projectUrl}:`,
      e
    );
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
  branch = null,
}: DownloadRepositoryFromProjectUrlInput): Promise<DownloadRepositoryFromProjectUrlResult> {
  const normalized = downloadRepositoryFromProjectUrlDeps.normalizeGithubProjectUrl({
    value: projectUrl,
  });
  if (!normalized.ok) {
    throw new Error('invalid-github-project-url');
  }
  // [why] Include the branch in the cache key so different branches get
  // independent cached checkouts. Falls back to empty string for null branch
  // (default branch) to keep backward-compatible cache keys.
  const cacheKey = toCacheKey({
    boardId,
    projectHash: `${normalized.value.hash}:${branch ?? ''}`,
  });

  // [why] When refresh=true, clear in-flight requests and bypass the cache
  // so a fresh git fetch from GitHub is always performed.
  if (refresh) {
    inFlightDownloads.delete(cacheKey);
  } else {
    const inFlight = inFlightDownloads.get(cacheKey);
    if (inFlight) return inFlight;
  }

  const task = downloadRepositoryForKey({
    cacheKey,
    projectUrl,
    boardId,
    refresh,
    branch,
  }).finally(() => {
    inFlightDownloads.delete(cacheKey);
  });
  inFlightDownloads.set(cacheKey, task);
  return task;
}
