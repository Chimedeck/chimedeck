// Impact analysis — scores how a card's intent overlaps with recently
// changed spec files to estimate which files need updates.
// [why] When a card is moved to a workflow phase, we need to predict
// which spec/docs files will be affected to feed into the file scope planner.

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ImpactAnalysisResult, ImpactedFile } from '../../types';
import { MAX_CHUNKS_PER_CONNECTOR } from '../../common/config';

/** Minimum overlap score for a file to be considered "impacted". */
const IMPACT_THRESHOLD = 0.15;

/** File system interface for testability. */
export interface ImpactFS {
  readFile: (filePath: string) => string;
  statFile: (filePath: string) => { mtimeMs: number } | null;
  globFiles: (pattern: string, cwd: string) => string[];
}

export const liveImpactFS: ImpactFS = {
  readFile: (filePath: string) => fs.readFileSync(filePath, 'utf-8'),
  statFile: (filePath: string) => {
    try {
      return fs.statSync(filePath);
    } catch {
      return null;
    }
  },
  globFiles: (pattern: string, cwd: string) => {
    // [why] Simple glob without external deps — handles basic patterns.
    const results: string[] = [];
    const dir = pattern.endsWith('/**') ? pattern.replace('/**', '') : cwd;
    try {
      const entries = fs.readdirSync(dir, { recursive: true, withFileTypes: false });
      for (const entry of entries as string[]) {
        const fullPath = path.join(dir, entry);
        if (entry.endsWith('.md') && fs.statSync(fullPath).isFile()) {
          results.push(fullPath);
        }
      }
    } catch {
      // Directory not found — return empty.
    }
    return results;
  },
};

/**
 * Extract word set from text as in duplicate detection.
 */
function extractWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 30),
  );
}

/**
 * Compute overlap score 0-1 between two word sets.
 */
function overlapScore(wordsA: Set<string>, wordsB: Set<string>): number {
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  return intersection / Math.max(wordsA.size, wordsB.size);
}

/**
 * Analyse which spec/docs files are likely impacted by a card's intent.
 * [why] Scans specs/ directory for .md files, checks word overlap against
 * intent, and prioritises recently modified files.
 */
export function analyseImpact({
  cardIntent,
  intentDescription,
  repoRoot,
  fs = liveImpactFS,
  recentlyModifiedWindowMs = 7 * 24 * 60 * 60 * 1000, // 7 days
}: {
  cardIntent: string;
  intentDescription: string;
  repoRoot: string;
  fs?: ImpactFS;
  recentlyModifiedWindowMs?: number;
}): ImpactAnalysisResult {
  const sourceWords = extractWords([cardIntent, intentDescription].join(' '));

  if (sourceWords.size === 0) {
    return { likelyImpactedFiles: [], overallOverlapScore: 0 };
  }

  const specFiles = fs.globFiles('specs/**', repoRoot);
  const impacted: ImpactedFile[] = [];
  let totalOverlap = 0;

  for (const filePath of specFiles) {
    try {
      const content = fs.readFile(filePath);
      const fileWords = extractWords(content);
      const score = overlapScore(sourceWords, fileWords);

      if (score >= IMPACT_THRESHOLD) {
        const matchedEntities = [...sourceWords].filter(w => fileWords.has(w));

        // [why] Recently modified files get a slight boost — they're more
        // likely to be relevant to ongoing work.
        const stat = fs.statFile(filePath);
        const now = Date.now();
        const isRecent = stat ? (now - stat.mtimeMs) < recentlyModifiedWindowMs : false;
        const adjustedScore = isRecent ? Math.min(score * 1.2, 1.0) : score;

        impacted.push({
          filePath: path.relative(repoRoot, filePath),
          impactScore: Math.round(adjustedScore * 100) / 100,
          reason: isRecent
            ? `Recently modified; ${matchedEntities.length} entity overlap`
            : `${matchedEntities.length} entity overlap`,
          matchedEntities: matchedEntities.slice(0, 5),
        });
        totalOverlap += score;
      }
    } catch {
      // File read error — skip.
    }
  }

  // [why] Sort by impact score descending, cap at connector limit.
  impacted.sort((a, b) => b.impactScore - a.impactScore);
  const topImpacted = impacted.slice(0, MAX_CHUNKS_PER_CONNECTOR);

  const overallOverlapScore =
    specFiles.length > 0
      ? Math.round((totalOverlap / specFiles.length) * 100) / 100
      : 0;

  return {
    likelyImpactedFiles: topImpacted,
    overallOverlapScore,
  };
}

export const impactAnalysisDeps = {
  analyseImpact,
};
