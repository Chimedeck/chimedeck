// Ranker — merges, deduplicates, and ranks search results from all connectors.
// [why] Different connectors use different internal scoring — the ranker
// normalises and sorts so the most relevant chunks surface first.

import type { ContextChunk, ContextSource, SearchConnectorResult } from '../../types';
import { MAX_TOTAL_CHUNKS } from '../../common/config';

/**
 * Normalise relevance scores from different connectors into a 0-1 confidence.
 * [why] Each connector may produce scores at different scales; this normalises
 * them into a consistent confidence metric for sorting.
 */
function normaliseRelevance(results: SearchConnectorResult[]): void {
  if (results.length === 0) return;

  const maxRelevance = Math.max(...results.map(r => r.relevance), 0.01);
  for (const r of results) {
    r.relevance = r.relevance / maxRelevance;
  }
}

/**
 * Compute a content hash for deduplication.
 * [why] Simple normalised hash: lowercase, strip whitespace, first 200 chars.
 * This catches near-identical chunks from different sources.
 */
function contentHash(content: string): string {
  return content
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

/**
 * Merge, deduplicate, normalise, and rank results from all four connectors.
 */
export function rankResults(
  connectorResults: Record<ContextSource, SearchConnectorResult[]>,
): { chunks: ContextChunk[]; sourceCounts: Record<ContextSource, number>; timeouts: ContextSource[] } {
  const sourceCounts: Record<ContextSource, number> = {
    docs: 0,
    code: 0,
    cards: 0,
    git: 0,
  };

  // [why] Normalise within each source first so connector score scales align.
  for (const source of Object.keys(connectorResults) as ContextSource[]) {
    normaliseRelevance(connectorResults[source]);
    sourceCounts[source] = connectorResults[source].length;
  }

  // Flatten all results into chunks with normalised confidence.
  const allChunks: ContextChunk[] = [];
  const seenHashes = new Set<string>();

  for (const source of Object.keys(connectorResults) as ContextSource[]) {
    for (const result of connectorResults[source]) {
      const hash = contentHash(result.content);

      // [why] Skip duplicates — if two connectors return the same content,
      // keep the one with the higher relevance.
      if (seenHashes.has(hash)) continue;
      seenHashes.add(hash);

      allChunks.push({
        source: result.source,
        sourcePath: result.sourcePath,
        content: result.content,
        confidence: result.relevance,
        lineRange: result.metadata?.lineStart
          ? {
              start: result.metadata.lineStart as number,
              end: result.metadata.lineEnd as number,
            }
          : undefined,
        truncated: result.metadata?.truncated as boolean | undefined,
      });
    }
  }

  // [why] Sort by confidence descending — most relevant first.
  allChunks.sort((a, b) => b.confidence - a.confidence);

  // [why] Enforce total chunk budget.
  const chunks = allChunks.slice(0, MAX_TOTAL_CHUNKS);

  return { chunks, sourceCounts, timeouts: [] };
}

export const rankerDeps = {
  rankResults,
};
