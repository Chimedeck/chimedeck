// Tests for createSprintCards — verifies child sprint cards are created
// with trace links and placed in the correct board list.
import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { CreateSprintCardsInput, SprintArtifact } from '../../../types';

// [why] Shared mock DB and persistence to avoid cross-file mock.module pollution in Bun.
import { sharedMockDb, sharedMockFirst, resetMockDb } from '../../../__tests__/mockDb';
import { mockCreateGeneratedSprintCard, persistenceMockModule } from '../../../__tests__/mockPersistence';

mock.module('../../../../../common/db', () => ({
  db: sharedMockDb,
}));

mock.module('../../persistence', persistenceMockModule);

let uuidCounter = 0;
const mockUUIDs = ['card-sprint-1', 'card-sprint-2', 'card-sprint-3', 'gen-link-1', 'gen-link-2', 'gen-link-3'];

mock.module('crypto', () => ({
  randomUUID: () => {
    const id = mockUUIDs[uuidCounter % mockUUIDs.length]!;
    uuidCounter++;
    return id;
  },
}));

function setUpListFallback() {
  sharedMockFirst.mockReset();
  // list lookup: first() = null (no "sprint" list), then null (no "doing"), then default list
  sharedMockFirst
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ id: 'list-default' });
}

describe('createSprintCards', () => {
  beforeEach(() => {
    uuidCounter = 0;
    setUpListFallback();
  });

  const makeArtifact = (overrides: Partial<SprintArtifact> = {}): SprintArtifact => ({
    sprintNumber: 1,
    title: 'Search Performance',
    filePath: 'specs/sprints/sprint-1.md',
    content: '# Sprint 1',
    requirements: ['REQ-1'],
    acceptanceCriteria: ['AC1'],
    testScenarios: ['Test 1'],
    dependencies: [],
    ...overrides,
  });

  it('creates child sprint cards and trace links for each artifact', async () => {
    const { createSprintCards } = await import('../createSprintCards');

    const input: CreateSprintCardsInput = {
      artifacts: [
        makeArtifact({ sprintNumber: 1, title: 'Search Performance', filePath: 'specs/sprints/sprint-1.md' }),
        makeArtifact({ sprintNumber: 2, title: 'Alternative Queries', filePath: 'specs/sprints/sprint-2.md', dependencies: [1] }),
      ],
      cardId: 'card-feature-1',
      workspaceId: 'ws-1',
      userId: 'user-1',
      boardId: 'board-1',
      runId: 'run-1',
    };

    const result = await createSprintCards(input);

    expect(result.status).toBe(201);
    expect(result.data).toBeDefined();
    expect(result.data!.createdCards).toHaveLength(2);
    expect(result.data!.createdCards[0]!.sprintNumber).toBe(1);
    expect(result.data!.createdCards[0]!.sprintCardId).toBe('card-sprint-1');
    expect(result.data!.createdCards[1]!.sprintNumber).toBe(2);
    expect(result.data!.createdCards[1]!.sprintCardId).toBe('card-sprint-2');
  });

  it('handles empty artifacts gracefully', async () => {
    const { createSprintCards } = await import('../createSprintCards');

    const input: CreateSprintCardsInput = {
      artifacts: [],
      cardId: 'card-feature-1',
      workspaceId: 'ws-1',
      userId: 'user-1',
      boardId: 'board-1',
      runId: 'run-1',
    };

    const result = await createSprintCards(input);

    // No cards to create should be a no-op, not an error
    expect(result.status).toBe(200);
    expect(result.data!.createdCards).toHaveLength(0);
  });
});
