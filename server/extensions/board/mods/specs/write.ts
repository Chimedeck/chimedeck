import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { readSpecsFile } from './read';
import { resolveSpecsFilePath } from './resolvePath';

export interface WriteSpecsFileInput {
  repoPath: string;
  filePath: string;
  content: string;
  ifMatch?: string | null;
}

export interface WriteSpecsFileResult {
  path: string;
  absolutePath: string;
  etag: string;
  sha: string;
  sizeBytes: number;
  created: boolean;
}

function isAllowedSpecsMarkdownPath(filePath: string): boolean {
  const normalized = filePath.replace(/^\/+/, '');
  return normalized.startsWith('specs/') && normalized.endsWith('.md');
}

function normalizeEntityTag(value: string): string {
  return value.trim().replace(/^W\//, '').replace(/^"|"$/g, '');
}

function parseIfMatchHeader(value: string | null | undefined): Set<string> | null {
  if (!value) return null;
  const tokens = value
    .split(',')
    .map((token) => normalizeEntityTag(token))
    .filter((token) => token.length > 0);
  return new Set(tokens);
}

function computeSha(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex').slice(0, 32);
}

export async function writeSpecsFile({
  repoPath,
  filePath,
  content,
  ifMatch,
}: WriteSpecsFileInput): Promise<WriteSpecsFileResult> {
  const resolved = resolveSpecsFilePath({ repoPath, filePath });
  if (!resolved.ok) {
    throw new Error(resolved.reason);
  }

  const relativePath = filePath.replace(/^\/+/, '');
  if (!isAllowedSpecsMarkdownPath(relativePath)) {
    throw new Error('specs-file-must-be-markdown');
  }

  let created = true;
  try {
    await stat(resolved.absolutePath);
    created = false;
  } catch {
    created = true;
  }

  if (!created) {
    const current = await readSpecsFile({ absolutePath: resolved.absolutePath });
    const matches = parseIfMatchHeader(ifMatch);
    if (matches && !matches.has('*') && !matches.has(current.etag)) {
      throw new Error('stale-specs-file-precondition');
    }
  }

  const buffer = Buffer.from(content, 'utf8');
  await mkdir(dirname(resolved.absolutePath), { recursive: true });
  await writeFile(resolved.absolutePath, buffer);

  const sha = computeSha(buffer);
  return {
    path: relativePath,
    absolutePath: resolved.absolutePath,
    etag: sha,
    sha,
    sizeBytes: buffer.length,
    created,
  };
}
