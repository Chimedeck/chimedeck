// Git history search connector — searches recent git commits for context.
// [why] Recent commit messages and changed files reveal the most recently
// modified areas of the codebase, which the AI should be aware of.

import type { SearchConnectorResult } from '../../types';
import { GIT_LOG_DEPTH, MAX_CHUNKS_PER_CONNECTOR } from '../../common/config';

/** Git operations — injected for testability. */
export interface GitOps {
  log: (repoRoot: string, depth: number, focusPaths?: string[]) => Promise<{ stdout: string; exitCode: number }>;
}

/** Production implementation using Bun.spawn. */
export const liveGitOps: GitOps = {
  log: async (repoRoot: string, depth: number, focusPaths?: string[]) => {
    const pathArgs = focusPaths && focusPaths.length > 0
      ? ['--', ...focusPaths]
      : [];

    const formatStr = '%H%n%s%n';
    const cmd = ['git', 'log', `-${depth}`, '--name-only', `--format=${formatStr}`, '---', ...pathArgs];

    const proc = Bun.spawn(cmd, {
      cwd: repoRoot,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    return { stdout, exitCode };
  },
};

interface GitCommit {
  hash: string;
  message: string;
  files: string[];
}

/**
 * Parse git log output into structured commit objects.
 */
function parseGitLog(raw: string): GitCommit[] {
  const commits: GitCommit[] = [];
  const entries = raw.split('\n---\n').filter(Boolean);

  for (const entry of entries) {
    const lines = entry.trim().split('\n');
    if (lines.length < 2) continue;

    const hash = lines[0].trim();
    const message = lines[1].trim();
    const files = lines.slice(2).map(l => l.trim()).filter(Boolean);

    commits.push({ hash, message, files });
  }

  return commits;
}

/**
 * Compute relevance of a commit to the intent.
 */
function commitRelevance(commit: GitCommit, intent: string): number {
  const intentWords = intent.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (intentWords.length === 0) return 0;

  const searchText = `${commit.message} ${commit.files.join(' ')}`.toLowerCase();
  let hits = 0;
  for (const word of intentWords) {
    if (searchText.includes(word)) hits++;
  }
  return hits / intentWords.length;
}

/**
 * Search recent git commits for context relevant to the intent.
 * Returns empty results gracefully if git is not available.
 */
export async function searchGit({
  repoRoot,
  intent,
  focusPaths,
  git = liveGitOps,
}: {
  repoRoot: string;
  intent: string;
  focusPaths?: string[];
  git?: GitOps;
}): Promise<SearchConnectorResult[]> {
  try {
    const { stdout, exitCode } = await git.log(repoRoot, GIT_LOG_DEPTH, focusPaths);

    if (exitCode !== 0) {
      // [why] Gracefully return empty when git is not initialised — never 500.
      console.warn('[aiContext/gitSearch] git log failed with exit code:', exitCode);
      return [];
    }

    const commits = parseGitLog(stdout);
    const scoredResults: { commit: GitCommit; score: number }[] = [];

    for (const commit of commits) {
      const score = commitRelevance(commit, intent);
      if (score > 0) {
        scoredResults.push({ commit, score });
      }
    }

    // Sort by relevance descending
    scoredResults.sort((a, b) => b.score - a.score);

    const results: SearchConnectorResult[] = [];
    for (const { commit, score } of scoredResults.slice(0, MAX_CHUNKS_PER_CONNECTOR)) {
      const fileList = commit.files.slice(0, 10).join(', ');
      results.push({
        source: 'git',
        sourcePath: commit.hash.slice(0, 7),
        content: `[${commit.hash.slice(0, 7)}] ${commit.message}\nFiles: ${fileList}${commit.files.length > 10 ? ` (+${commit.files.length - 10} more)` : ''}`,
        relevance: score,
        metadata: {
          hash: commit.hash,
          fullHash: commit.hash,
          fileCount: commit.files.length,
          files: commit.files.slice(0, 20),
        },
      });
    }

    return results;
  } catch (error) {
    // [why] Catch-all ensures gitSearch never crashes the pipeline.
    console.warn('[aiContext/gitSearch] Unexpected error:', error instanceof Error ? error.message : String(error));
    return [];
  }
}

export const gitSearchDeps = {
  searchGit,
};
