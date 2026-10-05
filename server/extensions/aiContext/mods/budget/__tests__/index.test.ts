import { describe, it, expect } from 'vitest';
import { applyBudget, estimateTokens } from '../index';
import type { ContextChunk } from '../../../types';

function makeChunk(content: string, confidence = 0.5): ContextChunk {
  return {
    source: 'docs',
    sourcePath: 'specs/test.md',
    content,
    confidence,
  };
}

describe('estimateTokens', () => {
  it('returns 1 for short strings', () => {
    expect(estimateTokens('ab')).toBe(1);
  });

  it('returns ceil of chars/4', () => {
    // 5 chars → 5/4 = 1.25 → ceil = 2
    expect(estimateTokens('hello')).toBe(2);
  });

  it('returns correct count for longer text', () => {
    const text = 'x'.repeat(100);
    expect(estimateTokens(text)).toBe(25);
  });
});

describe('applyBudget', () => {
  it('keeps all chunks when under budget', () => {
    const chunks = [makeChunk('short content')];
    const { chunks: kept, budget } = applyBudget({ chunks });
    expect(kept).toHaveLength(1);
    expect(budget.exceeded).toBe(false);
    expect(budget.droppedChunks).toBe(0);
    expect(budget.totalTokens).toBeGreaterThan(0);
  });

  it('drops chunks when token budget exceeded', () => {
    const bigChunk = makeChunk('x'.repeat(50000)); // ~12500 tokens
    const chunks = [bigChunk, makeChunk('small')];
    const { chunks: kept, budget } = applyBudget({
      chunks,
      config: { maxTokens: 10000, maxSizeBytes: 200_000 },
    });
    // First chunk exceeds token budget alone, so only "small" fits
    expect(kept.length).toBeLessThan(2);
    expect(budget.exceeded).toBe(true);
    expect(budget.droppedChunks).toBeGreaterThan(0);
  });

  it('drops chunks when size budget exceeded', () => {
    const bigChunk = makeChunk('x'.repeat(200_000)); // ~200KB
    const chunks = [bigChunk, makeChunk('small')];
    const { chunks: kept, budget } = applyBudget({
      chunks,
      config: { maxTokens: 100_000, maxSizeBytes: 50_000 },
    });
    expect(kept.length).toBeLessThan(2);
    expect(budget.exceeded).toBe(true);
  });

  it('preserves chunk order (best first)', () => {
    const chunks = [
      makeChunk('content a', 0.9),
      makeChunk('content b', 0.7),
      makeChunk('content c', 0.5),
    ];
    const { chunks: kept } = applyBudget({ chunks });
    expect(kept[0].confidence).toBe(0.9);
    expect(kept[1].confidence).toBe(0.7);
  });

  it('handles empty input', () => {
    const { chunks: kept, budget } = applyBudget({ chunks: [] });
    expect(kept).toHaveLength(0);
    expect(budget.totalTokens).toBe(0);
    expect(budget.droppedChunks).toBe(0);
    expect(budget.exceeded).toBe(false);
  });
});
