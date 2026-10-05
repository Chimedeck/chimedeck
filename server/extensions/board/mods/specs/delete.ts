// Deletes a specs markdown file from the cloned repository worktree.
// Used by the board chat assistant to remove obsolete documentation.
// The file must be under specs/ and end with .md.
import { unlink } from 'node:fs/promises';
import { resolveSpecsFilePath } from './resolvePath';

export interface DeleteSpecsFileInput {
  repoPath: string;
  filePath: string;
}

export interface DeleteSpecsFileResult {
  path: string;
  absolutePath: string;
  deleted: boolean;
}

function isAllowedSpecsMarkdownPath(filePath: string): boolean {
  const normalized = filePath.replace(/^\/+/, '');
  return normalized.startsWith('specs/') && normalized.endsWith('.md');
}

export async function deleteSpecsFile({
  repoPath,
  filePath,
}: DeleteSpecsFileInput): Promise<DeleteSpecsFileResult> {
  const resolved = resolveSpecsFilePath({ repoPath, filePath });
  if (!resolved.ok) {
    throw new Error(resolved.reason);
  }

  const relativePath = filePath.replace(/^\/+/, '');
  if (!isAllowedSpecsMarkdownPath(relativePath)) {
    throw new Error('specs-file-must-be-markdown');
  }

  try {
    await unlink(resolved.absolutePath);
    return {
      path: relativePath,
      absolutePath: resolved.absolutePath,
      deleted: true,
    };
  } catch (err: unknown) {
    // File doesn't exist — treat as already deleted
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        path: relativePath,
        absolutePath: resolved.absolutePath,
        deleted: false,
      };
    }
    throw err;
  }
}
