// Token and size budget manager for context gather payloads.
// [why] Large context payloads can overflow model input windows or cause
// excessive latency. The budget manager enforces caps and reports usage.

import type { ContextChunk, BudgetReport } from '../../types';

/** Rough estimate: 1 token ≈ 4 characters for English text. */
const CHARS_PER_TOKEN = 4;

/** Default budget limits — overridable via config. */
export interface BudgetConfig {
  maxTokens: number;
  maxSizeBytes: number;
}

const DEFAULT_BUDGET: BudgetConfig = {
  // [why] ~8k tokens is a safe window for most models while leaving
  // room for system prompt + user message.
  maxTokens: 8000,
  // [why] 100KB is a reasonable safety cap for a single API response.
  maxSizeBytes: 100_000,
};

/**
 * Estimate token count from a string using character-based heuristic.
 * [why] Character-to-token ratio is a fast approximation without requiring
 * a full tokeniser library. 4 chars/token is conservative for English.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Apply token and size budgets to a ranked list of chunks.
 * Returns the truncated list + a budget report.
 * [why] Chunks are already sorted by confidence by the ranker, so we
 * drop the least-relevant ones first when the budget is exceeded.
 */
export function applyBudget({
  chunks,
  config = DEFAULT_BUDGET,
}: {
  chunks: ContextChunk[];
  config?: BudgetConfig;
}): { chunks: ContextChunk[]; budget: BudgetReport } {
  let totalTokens = 0;
  let totalSizeBytes = 0;
  let droppedChunks = 0;
  const kept: ContextChunk[] = [];

  for (const chunk of chunks) {
    const chunkTokens = estimateTokens(chunk.content);
    const chunkBytes = Buffer.byteLength(chunk.content, 'utf-8');

    // [why] Check both limits before including — token budget is the
    // primary constraint since most models are token-bound.
    if (
      totalTokens + chunkTokens <= config.maxTokens &&
      totalSizeBytes + chunkBytes <= config.maxSizeBytes
    ) {
      kept.push(chunk);
      totalTokens += chunkTokens;
      totalSizeBytes += chunkBytes;
    } else {
      droppedChunks++;
    }
  }

  return {
    chunks: kept,
    budget: {
      totalTokens,
      maxTokens: config.maxTokens,
      totalSizeBytes,
      maxSizeBytes: config.maxSizeBytes,
      exceeded: droppedChunks > 0,
      droppedChunks,
    },
  };
}

export const budgetDeps = {
  applyBudget,
  estimateTokens,
};
