import { describe, it, expect } from 'vitest';
import { planFileScope } from '../index';
import type { ContextChunk, DuplicateCard, ImpactAnalysisResult } from '../../../types';

function makeChunk(sourcePath: string, confidence: number, source: 'docs' | 'code' = 'docs'): ContextChunk {
  return { source, sourcePath, content: 'test content', confidence };
}

describe('planFileScope', () => {
  const baseChunks: ContextChunk[] = [
    makeChunk('specs/sprints/sprint-1.md', 0.8),
    makeChunk('specs/architecture/architecture.md', 0.9),
    makeChunk('specs/request_changelog/change-1.md', 0.6),
  ];

  const baseDuplicates: DuplicateCard[] = [
    { cardId: 'dup1', cardTitle: 'Similar card', similarityScore: 0.7, reason: 'Similar keywords' },
  ];

  const baseImpact: ImpactAnalysisResult = {
    likelyImpactedFiles: [
      {
        filePath: 'specs/architecture/new-auth.md',
        impactScore: 0.8,
        reason: 'High keyword overlap',
        matchedEntities: ['authentication', 'oauth'],
      },
    ],
    overallOverlapScore: 0.3,
  };

  it('returns edit decisions for relevant existing files', () => {
    const result = planFileScope({
      chunks: baseChunks,
      duplicateCards: [],
      impact: { likelyImpactedFiles: [], overallOverlapScore: 0 },
      intent: 'test',
    });

    const sprintEntry = result.files.find(f => f.filePath === 'specs/sprints/sprint-1.md');
    expect(sprintEntry).toBeDefined();
    expect(sprintEntry!.decision).toBe('edit');
  });

  it('returns no-change for protected architecture files', () => {
    const result = planFileScope({
      chunks: baseChunks,
      duplicateCards: [],
      impact: { likelyImpactedFiles: [], overallOverlapScore: 0 },
      intent: 'test',
    });

    const archEntry = result.files.find(f => f.filePath === 'specs/architecture/architecture.md');
    expect(archEntry).toBeDefined();
    expect(archEntry!.decision).toBe('no-change');
  });

  it('returns create decisions for impacted files not in context', () => {
    const result = planFileScope({
      chunks: [],
      duplicateCards: [],
      impact: baseImpact,
      intent: 'Build authentication',
    });

    const createEntry = result.files.find(f => f.filePath === 'specs/architecture/new-auth.md');
    expect(createEntry).toBeDefined();
    expect(createEntry!.decision).toBe('create');
    expect(createEntry!.contentHint).toBeDefined();
  });

  it('sorts creates before edits', () => {
    const result = planFileScope({
      chunks: [
        makeChunk('specs/sprints/sprint-1.md', 0.9),
      ],
      duplicateCards: [],
      impact: {
        likelyImpactedFiles: [
          { filePath: 'specs/request_changelog/new-file.md', impactScore: 0.9, reason: 'New', matchedEntities: ['test'] },
        ],
        overallOverlapScore: 0.5,
      },
      intent: 'test',
    });

    const createIndex = result.files.findIndex(f => f.decision === 'create');
    const editIndex = result.files.findIndex(f => f.decision === 'edit');
    expect(createIndex).toBeLessThan(editIndex);
  });

  it('includes duplicate card info', () => {
    const result = planFileScope({
      chunks: [],
      duplicateCards: baseDuplicates,
      impact: { likelyImpactedFiles: [], overallOverlapScore: 0 },
      intent: 'test',
    });

    expect(result.possibleDuplicateCards).toEqual(baseDuplicates);
  });

  it('returns likelyImpactedFiles as string array', () => {
    const result = planFileScope({
      chunks: [],
      duplicateCards: [],
      impact: baseImpact,
      intent: 'test',
    });

    expect(result.likelyImpactedFiles).toContain('specs/architecture/new-auth.md');
  });

  it('computes confidence as average of file confidences', () => {
    const result = planFileScope({
      chunks: baseChunks,
      duplicateCards: [],
      impact: baseImpact,
      intent: 'test',
    });
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('returns default confidence 0.5 for empty plan', () => {
    const result = planFileScope({
      chunks: [],
      duplicateCards: [],
      impact: { likelyImpactedFiles: [], overallOverlapScore: 0 },
      intent: 'test',
    });
    expect(result.confidence).toBe(0.5);
  });
});
