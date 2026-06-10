// Docs search connector — searches specs/**/*.md files for relevant context.
// [why] Specs are the single source of truth per the architecture; searching
// them first gives the AI the most authoritative context.

import { resolve } from 'node:path';

import type { SearchConnectorResult } from '../../types';
import { MAX_FILE_SIZE_BYTES, MAX_CHUNKS_PER_CONNECTOR } from '../../common/config';

const DOCS_GLOB = 'specs/**/*.md';
const HEADING_RE = /^#{1,6}\s+(.+)$/m;

/** File system operations — injected for testability. */
export interface DocsFileSystem {
  globFiles: (pattern: string, cwd: string) => AsyncIterable<string>;
  readFile: (path: string) => Promise<{ text: string; size: number } | null>;
}

/** Production implementation using Bun APIs. */
export const liveDocsFS: DocsFileSystem = {
  globFiles: (pattern: string, cwd: string) => {
    const glob = new Bun.Glob(pattern);
    return glob.scan({ cwd, absolute: false });
  },
  readFile: async (absPath: string) => {
    try {
      const file = Bun.file(absPath);
      const size = file.size;
      const text = size > MAX_FILE_SIZE_BYTES
        ? await file.slice(0, MAX_FILE_SIZE_BYTES).text()
        : await file.text();
      return { text, size };
    } catch {
      return null;
    }
  },
};

interface RawChunk {
  heading: string;
  content: string;
}

/**
 * Split markdown content by headings into chunks.
 * [why] Heading-delimited chunks are natural semantic boundaries in spec docs.
 */
function chunkByHeading(content: string): RawChunk[] {
  const chunks: RawChunk[] = [];
  const lines = content.split('\n');
  let currentHeading = '(top)';
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      // Flush current chunk
      if (currentContent.length > 0) {
        chunks.push({ heading: currentHeading, content: currentContent.join('\n') });
      }
      currentHeading = headingMatch[1];
      currentContent = [line];
    } else {
      currentContent.push(line);
    }
  }
  // Flush final chunk
  if (currentContent.length > 0) {
    chunks.push({ heading: currentHeading, content: currentContent.join('\n') });
  }
  return chunks;
}

/**
 * Compute a simple TF-IDF-like relevance score between chunk text and the intent.
 * Returns a value between 0 and 1.
 */
function relevanceScore(chunkText: string, intent: string): number {
  const intentWords = new Set(intent.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const chunkWords = chunkText.toLowerCase().split(/\s+/);
  if (intentWords.size === 0 || chunkWords.length === 0) return 0;

  let hits = 0;
  for (const word of intentWords) {
    if (chunkWords.includes(word)) hits++;
  }
  // [why] Bonus for heading matches — headings carry more semantic weight.
  const hasHeadingMatch = Array.from(intentWords).some(
    w => chunkWords[0]?.includes(w) || (chunkWords[1]?.includes(w) && chunkText.startsWith('#')),
  );
  const baseScore = hits / intentWords.size;
  return Math.min(1, hasHeadingMatch ? baseScore * 1.3 : baseScore);
}

/**
 * Search docs files matching DOCS_GLOB for content relevant to the intent.
 */
export async function searchDocs({
  repoRoot,
  intent,
  fs = liveDocsFS,
}: {
  repoRoot: string;
  intent: string;
  fs?: DocsFileSystem;
}): Promise<SearchConnectorResult[]> {
  const results: SearchConnectorResult[] = [];

  const files: string[] = [];
  for await (const file of fs.globFiles(DOCS_GLOB, repoRoot)) {
    files.push(file);
  }

  for (const relativePath of files) {
    if (results.length >= MAX_CHUNKS_PER_CONNECTOR) break;

    const absolutePath = resolve(repoRoot, relativePath);
    const fileResult = await fs.readFile(absolutePath);
    if (!fileResult) continue;

    const { text: fileContent } = fileResult;
    const chunks = chunkByHeading(fileContent);

    for (const chunk of chunks) {
      if (results.length >= MAX_CHUNKS_PER_CONNECTOR) break;
      if (chunk.content.trim().length === 0) continue;

      const score = relevanceScore(`${chunk.heading} ${chunk.content}`, intent);
      // [why] Only return chunks with at least minimal relevance.
      if (score < 0.1) continue;

      results.push({
        source: 'docs',
        sourcePath: relativePath,
        content: chunk.content.length > 2000 ? chunk.content.slice(0, 2000) : chunk.content,
        relevance: score,
        metadata: { heading: chunk.heading, truncated: chunk.content.length > 2000 },
      });
    }
  }

  return results;
}

export const docsSearchDeps = {
  searchDocs,
};
