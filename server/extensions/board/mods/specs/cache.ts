// In-memory cache and in-flight dedup for specs manifest and file reads.
import type { SpecsManifest, SpecsManifestCacheEntry } from '../../types';

export { type SpecsManifestCacheEntry };

interface FileCacheEntry {
  content: string;
  etag: string;
  cachedAtMs: number;
}

// 5-minute TTL — same order as the repo download cache.
export const MANIFEST_CACHE_TTL_MS = 5 * 60 * 1000;
export const FILE_CACHE_TTL_MS = 5 * 60 * 1000;

export const specsManifestCache = new Map<string, SpecsManifestCacheEntry>();
export const specsManifestInflight = new Map<
  string,
  Promise<{ manifest: SpecsManifest; repoPath: string }>
>();
export const specsFileCache = new Map<string, FileCacheEntry>();
export const specsFileInflight = new Map<string, Promise<{ content: string; etag: string }>>();

export function invalidateSpecsManifestCache(cacheKey: string): void {
  specsManifestCache.delete(cacheKey);
  specsManifestInflight.delete(cacheKey);
}

export function invalidateSpecsFileCache(absolutePath: string): void {
  specsFileCache.delete(absolutePath);
  specsFileInflight.delete(absolutePath);
}

export function invalidateSpecsCachesForRepoPath(repoPath: string): void {
  const prefix = repoPath.endsWith('/') ? repoPath : `${repoPath}/`;

  for (const key of [...specsFileCache.keys()]) {
    if (key === repoPath || key.startsWith(prefix)) {
      specsFileCache.delete(key);
    }
  }

  for (const key of [...specsFileInflight.keys()]) {
    if (key === repoPath || key.startsWith(prefix)) {
      specsFileInflight.delete(key);
    }
  }
}

export function invalidateSpecsCachesForBoard({
  boardId,
  projectUrl,
  repoPath,
}: {
  boardId: string;
  projectUrl: string;
  repoPath: string;
}): void {
  invalidateSpecsManifestCache(`${boardId}:${projectUrl}`);
  invalidateSpecsCachesForRepoPath(repoPath);
}
