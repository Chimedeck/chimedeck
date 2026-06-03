// Builds a specs manifest by walking the checked-out repository for markdown files.
import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import type { SpecsManifest, SpecsManifestEntry } from '../../types';

async function walkMarkdownFiles({
  dir,
  repoPath,
}: {
  dir: string;
  repoPath: string;
}): Promise<SpecsManifestEntry[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const results: SpecsManifestEntry[] = [];

  for (const entry of entries) {
    // Skip hidden files and directories (e.g. .git, .github).
    if (entry.name.startsWith('.')) continue;

    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      const nested = await walkMarkdownFiles({ dir: fullPath, repoPath });
      results.push(...nested);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const info = await stat(fullPath);
      const relPath = relative(repoPath, fullPath);
      results.push({ path: relPath, sizeBytes: info.size });
    }
  }

  return results;
}

function computeManifestEtag({
  files,
  ref,
}: {
  files: SpecsManifestEntry[];
  ref: string;
}): string {
  const fingerprint = files.map((f) => `${f.path}:${f.sizeBytes}`).join('\n') + '\n' + ref;
  return createHash('sha256').update(fingerprint).digest('hex').slice(0, 32);
}

export async function buildSpecsManifest({
  repoPath,
  ref,
  fetchedAt,
}: {
  repoPath: string;
  ref: string;
  fetchedAt: string;
}): Promise<SpecsManifest> {
  const files = await walkMarkdownFiles({ dir: repoPath, repoPath });
  const sorted = files.slice().sort((a, b) => a.path.localeCompare(b.path));
  const etag = computeManifestEtag({ files: sorted, ref });

  return { ref, fetchedAt, files: sorted, etag };
}
