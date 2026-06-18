// File scope planner — returns a create/edit/no-change plan for files
// based on gathered context, duplicate detection, and impact analysis.
// [why] This is the decision engine that tells the AI Edit Orchestrator
// (Sprint 175) exactly which files to touch and why.

import type {
  ContextChunk,
  DuplicateCard,
  FileScopeEntry,
  FileScopeResponse,
  ImpactAnalysisResult,
} from '../../types';

/** Known doc locations that new files can be created into. */
const CREATABLE_ZONES = [
  'specs/request_changelog/',
  'specs/sprints/',
  'specs/architecture/',
  'specs/security/',
] as const;

/** Files that should never be auto-edited. */
const PROTECTED_FILES = [
  'specs/architecture/architecture.md',
  'specs/architecture/requirements.md',
  'specs/architecture/technical-decisions.md',
] as const;

/**
 * Determine whether a file path is in a creatable zone.
 */
function isCreatableZone(filePath: string): boolean {
  return CREATABLE_ZONES.some((zone) => filePath.startsWith(zone));
}

/**
 * Determine whether a file path is protected from auto-edits.
 */
function isProtectedFile(filePath: string): boolean {
  return PROTECTED_FILES.some((p) => filePath === p);
}

/**
 * Generate the file scope plan from gathered context, duplicates, and impact.
 * [why] Combine three signals — context chunks tell us what exists,
 * duplicates warn about redundant work, and impact tells us what to change.
 */
export function planFileScope({
  chunks,
  duplicateCards,
  impact,
  intent,
}: {
  chunks: ContextChunk[];
  duplicateCards: DuplicateCard[];
  impact: ImpactAnalysisResult;
  intent: string;
}): FileScopeResponse {
  const files: FileScopeEntry[] = [];
  const seenPaths = new Set<string>();

  // [why] From context chunks: files that exist and are relevant → "edit".
  for (const chunk of chunks) {
    if (chunk.source === 'docs' && chunk.sourcePath && !seenPaths.has(chunk.sourcePath)) {
      seenPaths.add(chunk.sourcePath);

      if (isProtectedFile(chunk.sourcePath)) {
        // [why] Protected files are referenced but never auto-edited.
        files.push({
          filePath: chunk.sourcePath,
          decision: 'no-change',
          rationale: 'Protected architecture file — no auto-edits',
          confidence: 1.0,
        });
      } else if (chunk.confidence >= 0.3) {
        files.push({
          filePath: chunk.sourcePath,
          decision: 'edit',
          rationale: `Relevant context found (confidence: ${chunk.confidence.toFixed(2)})`,
          confidence: chunk.confidence,
        });
      }
    }
  }

  // [why] From impact analysis: files not in context but highly impacted → "create".
  for (const impactedFile of impact.likelyImpactedFiles) {
    if (!seenPaths.has(impactedFile.filePath)) {
      seenPaths.add(impactedFile.filePath);

      if (isCreatableZone(impactedFile.filePath)) {
        files.push({
          filePath: impactedFile.filePath,
          decision: 'create',
          rationale: `High impact (${impactedFile.impactScore}) — ${impactedFile.reason}`,
          confidence: impactedFile.impactScore,
          contentHint: `Generated based on intent: "${intent.slice(0, 100)}"`,
        });
      }
    }
  }

  // [why] For highly duplicative cards: note which would be "no-change".
  for (const dup of duplicateCards) {
    // [why] Don't add duplicate card entries as files; they're surfaced
    // in possibleDuplicateCards already.
  }

  // [why] Sort: creates first (dependencies), then edits.
  files.sort((a, b) => {
    if (a.decision === 'create' && b.decision !== 'create') return -1;
    if (a.decision !== 'create' && b.decision === 'create') return 1;
    return b.confidence - a.confidence;
  });

  // Compute overall plan confidence.
  const avgConfidence =
    files.length > 0 ? files.reduce((sum, f) => sum + f.confidence, 0) / files.length : 0.5;

  return {
    files,
    possibleDuplicateCards: duplicateCards,
    likelyImpactedFiles: impact.likelyImpactedFiles.map((f) => f.filePath),
    confidence: Math.round(avgConfidence * 100) / 100,
    snapshotId: '', // [why] Set by caller after snapshot is persisted.
  };
}

export const fileScopePlannerDeps = {
  planFileScope,
};
