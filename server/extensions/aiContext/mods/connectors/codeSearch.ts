// Code search connector — searches src/** and server/** for relevant code.
// [why] Existing code is the most reliable source of implementation conventions
// and patterns that the AI should respect.

import { resolve } from 'node:path';

import type { SearchConnectorResult } from '../../types';
import { MAX_FILE_SIZE_BYTES, MAX_CHUNKS_PER_CONNECTOR } from '../../common/config';

const CODE_GLOBS = ['src/**/*.{ts,tsx,js,jsx}', 'server/**/*.{ts,js}'];
const EXCLUDE_PATTERNS = [/node_modules/, /__tests__/, /\.test\./, /\.spec\./, /dist\//];
const LINE_CHUNK_SIZE = 10;

/** File system operations — injected for testability. */
export interface CodeFileSystem {
  globFiles: (pattern: string, cwd: string) => AsyncIterable<string>;
  readFile: (path: string) => Promise<{ text: string; size: number } | null>;
}

/** Production implementation using Bun APIs. */
export const liveCodeFS: CodeFileSystem = {
  globFiles: (pattern: string, cwd: string) => {
    const glob = new Bun.Glob(pattern);
    return glob.scan({ cwd, absolute: false });
  },
  readFile: async (absPath: string) => {
    try {
      const file = Bun.file(absPath);
      const size = file.size;
      const text =
        size > MAX_FILE_SIZE_BYTES
          ? await file.slice(0, MAX_FILE_SIZE_BYTES).text()
          : await file.text();
      return { text, size };
    } catch {
      return null;
    }
  },
};

interface FileMatch {
  relativePath: string;
  lines: string[];
  lineStart: number;
  score: number;
}

/**
 * Check whether a file path should be excluded from search.
 */
function isExcluded(path: string): boolean {
  return EXCLUDE_PATTERNS.some((p) => p.test(path));
}

/**
 * Simple keyword-based relevance scoring for code search.
 */
function scoreCodeLines(lines: string[], intent: string): number {
  const intentWords = intent
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (intentWords.length === 0) return 0;

  let hits = 0;
  for (const line of lines) {
    const lower = line.toLowerCase();
    for (const word of intentWords) {
      if (lower.includes(word)) hits++;
    }
  }
  return Math.min(1, hits / (lines.length * intentWords.length * 0.5));
}

/**
 * Search code files for content relevant to the intent.
 */
export async function searchCode({
  repoRoot,
  intent,
  fs = liveCodeFS,
}: {
  repoRoot: string;
  intent: string;
  fs?: CodeFileSystem;
}): Promise<SearchConnectorResult[]> {
  const results: SearchConnectorResult[] = [];

  // [why] Collect files from all glob patterns.
  const allFiles: string[] = [];
  for (const codeGlob of CODE_GLOBS) {
    for await (const file of fs.globFiles(codeGlob, repoRoot)) {
      if (!isExcluded(file)) allFiles.push(file);
    }
  }

  // Deduplicate files
  const uniqueFiles = [...new Set(allFiles)];

  const fileMatches: FileMatch[] = [];

  for (const relativePath of uniqueFiles) {
    if (fileMatches.length >= MAX_CHUNKS_PER_CONNECTOR * 2) break;

    const absolutePath = resolve(repoRoot, relativePath);
    const fileResult = await fs.readFile(absolutePath);
    if (!fileResult) continue;

    const { text: fileContent } = fileResult;

    const lines = fileContent.split('\n');

    // [why] Score sliding windows of lines — catches related code blocks.
    for (let i = 0; i < lines.length; i += Math.floor(LINE_CHUNK_SIZE / 2)) {
      const chunk = lines.slice(i, i + LINE_CHUNK_SIZE);
      const score = scoreCodeLines(chunk, intent);

      if (score > 0.05) {
        fileMatches.push({
          relativePath,
          lines: chunk,
          lineStart: i + 1,
          score,
        });
      }
    }
  }

  // [why] Sort by score descending and take top results.
  fileMatches.sort((a, b) => b.score - a.score);

  for (const match of fileMatches.slice(0, MAX_CHUNKS_PER_CONNECTOR)) {
    results.push({
      source: 'code',
      sourcePath: match.relativePath,
      content: match.lines.join('\n'),
      relevance: match.score,
      metadata: {
        lineStart: match.lineStart,
        lineEnd: match.lineStart + match.lines.length - 1,
      },
    });
  }

  return results;
}

export const codeSearchDeps = {
  searchCode,
};
