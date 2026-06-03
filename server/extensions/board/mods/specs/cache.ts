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
export const specsManifestInflight = new Map<string, Promise<{ manifest: SpecsManifest; repoPath: string }>>();
export const specsFileCache = new Map<string, FileCacheEntry>();
export const specsFileInflight = new Map<string, Promise<{ content: string; etag: string }>>();
