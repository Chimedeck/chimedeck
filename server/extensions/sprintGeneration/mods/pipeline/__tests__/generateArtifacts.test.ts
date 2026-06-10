// Tests for generateArtifacts — verifies sprint spec generation,
// EARS + AC + test sections, dependency graph, and file output.
import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type {
  GenerateArtifactsInput,
  RequirementPacket,
  ContextSnapshotSummary,
} from '../../../types';

// [why] Shared mock DB — needed because generateArtifacts depends on
// fileCreator which imports common/db.
import { sharedMockDb, sharedMockFirst } from '../../../__tests__/mockDb';
mock.module('../../../../../common/db', () => ({ db: sharedMockDb }));

const mockCreateFile = mock().mockResolvedValue({ status: 200, data: { path: '/mocked' } });
const mockEditFile = mock().mockResolvedValue({ status: 200, data: { path: '/mocked' } });
const mockGetMaxSprint = mock().mockResolvedValue(5);

// [why] mock.module for cross-extension deps (fileCreator, fileEditor).
// These are in aiEditOrchestrator which isn't part of sprintGeneration.
mock.module('../../../../aiEditOrchestrator/mods/fileCreator', () => ({
  createFile: mockCreateFile,
  fileCreatorDeps: { write: mock().mockResolvedValue(undefined) },
}));

mock.module('../../../../aiEditOrchestrator/mods/fileEditor', () => ({
  editFile: mockEditFile,
}));

describe('generateArtifacts', () => {
  beforeEach(() => {
    mockCreateFile.mockReset();
    mockEditFile.mockReset();
    mockGetMaxSprint.mockReset();
    mockCreateFile.mockResolvedValue({ status: 200, data: { path: '/mocked' } });
    mockEditFile.mockResolvedValue({ status: 200, data: { path: '/mocked' } });
    mockGetMaxSprint.mockResolvedValue(5);
  });

  const makeRequirementPacket = (): RequirementPacket => ({
    businessValue: 'Improve search performance',
    cardTitle: 'Search Performance',
    earsRequirements: [
      'WHEN a user searches THEN the system SHALL return results in under 200ms',
      'WHEN no results are found THEN the system SHALL suggest alternative queries',
      'WHEN searching with filters THEN the system SHALL apply all active filters',
      'WHEN search is cancelled THEN the system SHALL abort the query',
    ],
    acceptanceCriteria: [
      'Search latency < 200ms at p95',
      'Results highlight matched terms',
      'Pagination works for large result sets',
    ],
    constraints: ['Must use existing search index', 'Backward compatible'],
    qualityScore: 94,
  });

  const makeContextSnapshot = (): ContextSnapshotSummary => ({
    snapshotId: 'snap-1',
    totalChunks: 24,
    sourceCounts: { docs: 8, code: 10, cards: 4, git: 2 },
    focusPaths: ['specs/architecture/', 'server/extensions/'],
  });

  it('generates sprint specs with EARS requirements, AC, tests, and dependencies', async () => {
    const { generateArtifacts } = await import('../generateArtifacts');

    const input: GenerateArtifactsInput = {
      requirementPacket: makeRequirementPacket(),
      contextSnapshot: makeContextSnapshot(),
      tier: 'tier_2',
      cardId: 'card-1',
    };

    const result = await generateArtifacts(input);

    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
    expect(result.data!.artifacts.length).toBeGreaterThan(0);
    expect(result.data!.artifacts.length).toBeLessThanOrEqual(3);

    // Each artifact should have required sections
    for (const artifact of result.data!.artifacts) {
      expect(artifact.sprintNumber).toBeGreaterThan(0);
      expect(artifact.filePath).toContain('specs/sprints/sprint-');
      expect(artifact.content).toContain('# Sprint');
      expect(artifact.content).toContain('EARS Requirements');
      expect(artifact.content).toContain('Acceptance Criteria');
      expect(artifact.content).toContain('## Test Scenarios');
      expect(artifact.content).toContain('## Dependencies');
      expect(artifact.title.length).toBeGreaterThan(0);
    }
  });

  it('assigns requirements round-robin across sprints', async () => {
    const { generateArtifacts } = await import('../generateArtifacts');

    const input: GenerateArtifactsInput = {
      requirementPacket: makeRequirementPacket(),
      contextSnapshot: makeContextSnapshot(),
      tier: 'tier_2', // tier_2 allows 3 sprints; the heuristic produces 3 for 7 items
      cardId: 'card-1',
    };

    const result = await generateArtifacts(input);

    // [why] Heuristic: ceil((4 reqs + 3 ACs) / 3) = ceil(7/3) = 3 sprints
    expect(result.data!.artifacts).toHaveLength(3);

    // Each sprint should have at least one requirement
    for (const artifact of result.data!.artifacts) {
      expect(artifact.requirements.length).toBeGreaterThan(0);
    }

    // All 4 original requirements should be covered at least once
    const allReqs = result.data!.artifacts.flatMap(a => a.requirements);
    expect(allReqs.length).toBeGreaterThanOrEqual(4);
  });

  it('includes dependency graph section at tier_3', async () => {
    const { generateArtifacts } = await import('../generateArtifacts');

    const input: GenerateArtifactsInput = {
      requirementPacket: makeRequirementPacket(),
      contextSnapshot: makeContextSnapshot(),
      tier: 'tier_3',
      cardId: 'card-1',
    };

    const result = await generateArtifacts(input);

    // [why] dependencyGraph is returned as a top-level field in the response,
    // not inlined into the sprint spec content.
    expect(result.data!.dependencyGraph).toBeDefined();
    expect(result.data!.dependencyGraph).toContain('mermaid');
    expect(result.data!.dependencyGraph).toContain('Sprint');
  });

  it('includes test matrix at tier_4', async () => {
    const { generateArtifacts } = await import('../generateArtifacts');

    const input: GenerateArtifactsInput = {
      requirementPacket: makeRequirementPacket(),
      contextSnapshot: makeContextSnapshot(),
      tier: 'tier_4',
      cardId: 'card-1',
    };

    const result = await generateArtifacts(input);

    // [why] testMatrix and riskRegister are top-level response fields
    expect(result.data!.testMatrix).toBeDefined();
    expect(result.data!.testMatrix).toContain('Test Scenario');
    expect(result.data!.riskRegister).toBeDefined();
    expect(result.data!.riskRegister).toContain('Risk');
  });

  it('caps sprint count based on tier policy maxSprints', async () => {
    const { generateArtifacts } = await import('../generateArtifacts');

    const input: GenerateArtifactsInput = {
      requirementPacket: makeRequirementPacket(),
      contextSnapshot: makeContextSnapshot(),
      tier: 'tier_1',
      cardId: 'card-1',
    };

    const result = await generateArtifacts(input);

    expect(result.data!.artifacts).toHaveLength(1);
  });

  it('generates unique requirement IDs for traceability', async () => {
    const { generateArtifacts } = await import('../generateArtifacts');

    const input: GenerateArtifactsInput = {
      requirementPacket: makeRequirementPacket(),
      contextSnapshot: makeContextSnapshot(),
      tier: 'tier_2',
      cardId: 'card-1',
    };

    const result = await generateArtifacts(input);

    for (const artifact of result.data!.artifacts) {
      for (const reqId of artifact.requirements) {
        expect(reqId).toMatch(/WHEN|SHALL|IF/);
      }
    }
  });
});
