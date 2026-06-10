// Gather pipeline — runs all four connectors concurrently with timeout budgets,
// ranks results, redacts secrets, applies budget, persists snapshot,
// and returns the final context payload.
// [why] Each connector is isolated with its own timeout so one slow connector
// doesn't block the entire pipeline.

import { searchDocs } from '../connectors/docsSearch';
import { searchCode } from '../connectors/codeSearch';
import { searchCards } from '../connectors/cardsSearch';
import { searchGit } from '../connectors/gitSearch';
import { rankResults } from '../ranker';
import { redactSecrets } from '../security/secretRedactor';
import { validatePathAllowlist } from '../security/pathAllowlist';
import { applyBudget } from '../budget';
import { persistSnapshot } from '../snapshots';
import { CONNECTOR_TIMEOUT_MS } from '../../common/config';
import type { ContextGatherInput, GatherPipelineResult, SearchConnectorResult, ContextSource } from '../../types';

/**
 * Run a connector with a timeout budget. Returns empty array on timeout.
 * [why] Promise.race with a timer ensures no connector hangs the pipeline.
 */
async function withTimeout<T>(
  label: string,
  fn: () => Promise<T[]>,
  timeoutMs: number,
): Promise<{ results: T[]; timedOut: boolean }> {
  const timer = setTimeout(() => {
    // Timer fires — Promise.race below will resolve with the timeout result
  }, timeoutMs);

  const timeout = new Promise<T[]>((resolve) => {
    setTimeout(() => {
      console.warn(`[aiContext/gather] ${label} timed out after ${timeoutMs}ms`);
      resolve([]);
    }, timeoutMs);
  });

  try {
    const results = await Promise.race([fn(), timeout]);
    return { results, timedOut: false };
  } catch (error) {
    console.warn(`[aiContext/gather] ${label} failed:`, error instanceof Error ? error.message : String(error));
    return { results: [], timedOut: false };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve the repository root for file-based connectors.
 * [why] All file searches are relative to the git repo root so connectors
 * can resolve absolute paths for file access.
 */
function resolveRepoRoot(): string {
  return process.cwd();
}

export interface GatherPipelineDeps {
  searchDocs: typeof searchDocs;
  searchCode: typeof searchCode;
  searchCards: typeof searchCards;
  searchGit: typeof searchGit;
  validatePathAllowlist: typeof validatePathAllowlist;
  rankResults: typeof rankResults;
  redactSecrets: typeof redactSecrets;
  applyBudget: typeof applyBudget;
  persistSnapshot: typeof persistSnapshot;
}

const defaultDeps: GatherPipelineDeps = {
  searchDocs,
  searchCode,
  searchCards,
  searchGit,
  validatePathAllowlist,
  rankResults,
  redactSecrets,
  applyBudget,
  persistSnapshot,
};

/**
 * Run the full gather pipeline: validate input, run connectors, rank, redact.
 */
export async function runGatherPipeline(
  input: ContextGatherInput,
  deps: GatherPipelineDeps = defaultDeps,
): Promise<GatherPipelineResult> {
  const { cardId, intent, focusPaths } = input;

  // 1. Validate path allowlist
  const pathError = deps.validatePathAllowlist({ focusPaths });
  if (pathError) {
    return {
      status: pathError.status,
      name: pathError.name,
      message: pathError.message,
    };
  }

  const repoRoot = resolveRepoRoot();
  const timeouts: ContextSource[] = [];

  // 2. Run all four connectors concurrently with timeout budgets
  const [docsResult, codeResult, cardsResult, gitResult] = await Promise.all([
    withTimeout('docsSearch', () => deps.searchDocs({ repoRoot, intent }), CONNECTOR_TIMEOUT_MS),
    withTimeout('codeSearch', () => deps.searchCode({ repoRoot, intent }), CONNECTOR_TIMEOUT_MS),
    withTimeout('cardsSearch', () => deps.searchCards({ cardId, intent }), CONNECTOR_TIMEOUT_MS),
    withTimeout('gitSearch', () => deps.searchGit({ repoRoot, intent, focusPaths }), CONNECTOR_TIMEOUT_MS),
  ]);

  const connectorResults: Record<ContextSource, SearchConnectorResult[]> = {
    docs: docsResult.results,
    code: codeResult.results,
    cards: cardsResult.results,
    git: gitResult.results,
  };

  if (docsResult.timedOut) timeouts.push('docs');
  if (codeResult.timedOut) timeouts.push('code');
  if (cardsResult.timedOut) timeouts.push('cards');
  if (gitResult.timedOut) timeouts.push('git');

  // 3. Rank, deduplicate, and normalise results
  const { chunks, sourceCounts } = deps.rankResults(connectorResults);

  // 4. Redact secrets before returning
  const redactedChunks = deps.redactSecrets(chunks);

  // 5. Apply token/size budget
  const { chunks: budgetedChunks, budget } = deps.applyBudget({ chunks: redactedChunks });

  // 6. Persist snapshot for traceability
  let snapshotId: string | undefined;
  try {
    const result = await deps.persistSnapshot({
      cardId,
      intent,
      gatherResponse: {
        chunks: budgetedChunks,
        sourceCounts,
        totalReturned: budgetedChunks.length,
        timeouts,
      },
      focusPaths,
    });
    snapshotId = result.snapshotId;
  } catch (error) {
    // [why] Snapshot persistence is best-effort — don't fail the gather
    // call if the snapshot write fails (e.g. migration hasn't run yet).
    console.warn('[aiContext/gather] Snapshot persistence failed:', error instanceof Error ? error.message : String(error));
  }

  return {
    status: 200,
    data: {
      chunks: budgetedChunks,
      sourceCounts,
      totalReturned: budgetedChunks.length,
      timeouts,
      snapshotId,
      budget,
    },
  };
}

export const gatherPipelineDeps = {
  runGatherPipeline,
  defaultDeps,
};
