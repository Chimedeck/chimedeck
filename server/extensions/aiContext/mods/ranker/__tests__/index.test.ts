// Tests for ranker — merging, deduplication, and sorting.
import { describe, it, expect } from 'vitest';
import { rankResults } from '../index';
import type { SearchConnectorResult, ContextSource } from '../../../types';

describe('rankResults', () => {
  it('returns empty chunks when no connector results', () => {
    const empty: Record<ContextSource, SearchConnectorResult[]> = {
      docs: [],
      code: [],
      cards: [],
      git: [],
    };

    const { chunks, sourceCounts } = rankResults(empty);

    expect(chunks).toEqual([]);
    expect(sourceCounts.docs).toBe(0);
    expect(sourceCounts.code).toBe(0);
    expect(sourceCounts.cards).toBe(0);
    expect(sourceCounts.git).toBe(0);
  });

  it('deduplicates identical content across sources', () => {
    const duplicateContent = 'This is duplicate content across sources.';

    const results: Record<ContextSource, SearchConnectorResult[]> = {
      docs: [
        { source: 'docs', sourcePath: 'specs/a.md', content: duplicateContent, relevance: 0.9 },
      ],
      code: [{ source: 'code', sourcePath: 'src/a.ts', content: duplicateContent, relevance: 0.7 }],
      cards: [],
      git: [],
    };

    const { chunks } = rankResults(results);

    // [why] Deduplication should keep only one copy of identical content.
    expect(chunks.length).toBe(1);
  });

  it('sorts by confidence descending', () => {
    const results: Record<ContextSource, SearchConnectorResult[]> = {
      docs: [
        { source: 'docs', sourcePath: 'specs/a.md', content: 'Low relevance', relevance: 0.3 },
        { source: 'docs', sourcePath: 'specs/b.md', content: 'High relevance', relevance: 0.9 },
        { source: 'docs', sourcePath: 'specs/c.md', content: 'Mid relevance', relevance: 0.6 },
      ],
      code: [],
      cards: [],
      git: [],
    };

    const { chunks } = rankResults(results);

    expect(chunks.length).toBe(3);
    // [why] Sorted by confidence descending: 0.9, 0.6, 0.3 after normalisation.
    expect(chunks[0].confidence).toBeGreaterThanOrEqual(chunks[1].confidence);
    expect(chunks[1].confidence).toBeGreaterThanOrEqual(chunks[2].confidence);
    expect(chunks[0].content).toBe('High relevance');
    expect(chunks[2].content).toBe('Low relevance');
  });

  it('maintains source attribution after ranking', () => {
    const results: Record<ContextSource, SearchConnectorResult[]> = {
      docs: [{ source: 'docs', sourcePath: 'specs/a.md', content: 'Doc content', relevance: 0.5 }],
      code: [{ source: 'code', sourcePath: 'src/b.ts', content: 'Code content', relevance: 0.8 }],
      cards: [{ source: 'cards', sourcePath: 'card-1', content: 'Card content', relevance: 0.3 }],
      git: [],
    };

    const { chunks, sourceCounts } = rankResults(results);

    // [why] Each source should be represented in sourceCounts.
    expect(sourceCounts.docs).toBe(1);
    expect(sourceCounts.code).toBe(1);
    expect(sourceCounts.cards).toBe(1);

    // [why] Sources should remain correctly attributed after ranking.
    const sources = chunks.map((c) => c.source);
    expect(sources).toContain('docs');
    expect(sources).toContain('code');
    expect(sources).toContain('cards');
  });
});
