// Lists all markdown files under specs/ in a cloned repository worktree.
// Used by the board chat assistant to discover existing documentation before
// proposing edits or new files.
import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { resolveSpecsFilePath } from './resolvePath';

export interface ListSpecsFilesInput {
  repoPath: string;
}

export interface SpecsFileEntry {
  path: string;
  sizeBytes: number;
}

// [why] Recursively walk specs/ directory collecting all .md files.
// Uses a breadth-first approach to avoid deep recursion issues.
async function walkSpecsDir(repoPath: string): Promise<SpecsFileEntry[]> {
  const specsRoot = join(repoPath, 'specs');
  const entries: SpecsFileEntry[] = [];
  const dirs: string[] = [specsRoot];

  while (dirs.length > 0) {
    const currentDir = dirs.shift()!;
    let items: string[];
    try {
      items = await readdir(currentDir, { withFileTypes: true });
    } catch {
      // Directory doesn't exist or is inaccessible — skip
      continue;
    }

    for (const item of items) {
      const fullPath = join(currentDir, item.name);
      if (item.isDirectory()) {
        dirs.push(fullPath);
      } else if (item.isFile() && item.name.endsWith('.md')) {
        try {
          const info = await stat(fullPath);
          entries.push({
            path: relative(repoPath, fullPath),
            sizeBytes: info.size,
          });
        } catch {
          // File disappeared between readdir and stat — skip
        }
      }
    }
  }

  return entries;
}

export async function listSpecsFiles({
  repoPath,
}: ListSpecsFilesInput): Promise<SpecsFileEntry[]> {
  return walkSpecsDir(repoPath);
}
