// Resolves a relative file path to an absolute path within a repo root.
// Rejects absolute paths, null bytes, and traversals that escape the root.
import { join, normalize, isAbsolute } from 'node:path';

export type ResolvePathResult = { ok: true; absolutePath: string } | { ok: false; reason: string };

export function resolveSpecsFilePath({
  repoPath,
  filePath,
}: {
  repoPath: string;
  filePath: string;
}): ResolvePathResult {
  if (isAbsolute(filePath)) {
    return { ok: false, reason: 'path-must-be-relative' };
  }

  if (filePath.includes('\0')) {
    return { ok: false, reason: 'path-contains-null-byte' };
  }

  const normalizedPath = normalize(filePath);

  if (normalizedPath.startsWith('..')) {
    return { ok: false, reason: 'path-traversal-detected' };
  }

  const absolutePath = join(repoPath, normalizedPath);

  // Double-check: ensure the resolved path stays under the repo root.
  const root = repoPath.endsWith('/') ? repoPath : `${repoPath}/`;
  if (!absolutePath.startsWith(root) && absolutePath !== repoPath) {
    return { ok: false, reason: 'path-traversal-detected' };
  }

  return { ok: true, absolutePath };
}
