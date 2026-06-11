import { describe, expect, it, beforeEach, vi } from 'bun:test';
import {
  resolveColumnWorkflowPhases,
  resolvePhaseConfig,
  invalidatePhaseCacheForBoard,
} from '../index';

// [why] Mock the db import so we can test the resolver without a real DB.
vi.mock('../../../../../common/db', () => ({
  db: vi.fn(),
}));

import { db } from '../../../../../common/db';

beforeEach(() => {
  invalidatePhaseCacheForBoard('board-1');
  invalidatePhaseCacheForBoard('board-2');
  vi.clearAllMocks();
});

function mockGraphData(nodes: Array<{
  id: string;
  listId: string;
  label: string;
  positionX: number;
  positionY: number;
  workflowPhases?: string[];
  phaseConfig?: Record<string, unknown>;
}>): unknown {
  return {
    nodes,
    edges: [],
    notes: [],
  };
}

describe('phaseResolver', () => {
  it('returns phases for a list with configured phases', async () => {
    (db as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      where: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({
          board_id: 'board-1',
          graph_data: mockGraphData([
            { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 100, positionY: 80, workflowPhases: ['NEW_DRAFT', 'SYNC_DOCUMENT'] },
          ]),
        }),
      }),
    });

    const phases = await resolveColumnWorkflowPhases({ boardId: 'board-1', listId: 'list-1' });
    expect(phases).toEqual(['NEW_DRAFT', 'SYNC_DOCUMENT']);
  });

  it('returns empty array for list without phases', async () => {
    (db as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      where: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({
          board_id: 'board-1',
          graph_data: mockGraphData([
            { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 100, positionY: 80 },
          ]),
        }),
      }),
    });

    const phases = await resolveColumnWorkflowPhases({ boardId: 'board-1', listId: 'list-1' });
    expect(phases).toEqual([]);
  });

  it('returns phases for a different list in the same board', async () => {
    (db as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      where: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({
          board_id: 'board-1',
          graph_data: mockGraphData([
            { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 100, positionY: 80 },
            { id: 'list-2', listId: 'list-2', label: 'In Progress', positionX: 340, positionY: 80, workflowPhases: ['READY_FOR_DEV'] },
          ]),
        }),
      }),
    });

    const phases1 = await resolveColumnWorkflowPhases({ boardId: 'board-1', listId: 'list-1' });
    expect(phases1).toEqual([]);

    const phases2 = await resolveColumnWorkflowPhases({ boardId: 'board-1', listId: 'list-2' });
    expect(phases2).toEqual(['READY_FOR_DEV']);
  });

  it('resolves phaseConfig defaults when no config set', async () => {
    (db as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      where: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({
          board_id: 'board-1',
          graph_data: mockGraphData([
            { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 100, positionY: 80 },
          ]),
        }),
      }),
    });

    const config = await resolvePhaseConfig({ boardId: 'board-1', listId: 'list-1' });
    expect(config).toEqual({
      serviceTierOverride: null,
      autoRun: false,
      requiresHumanApproval: true,
    });
  });

  it('resolves custom phaseConfig', async () => {
    (db as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      where: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({
          board_id: 'board-1',
          graph_data: mockGraphData([
            {
              id: 'list-1',
              listId: 'list-1',
              label: 'Todo',
              positionX: 100,
              positionY: 80,
              phaseConfig: {
                serviceTierOverride: 'enterprise',
                autoRun: true,
                requiresHumanApproval: false,
              },
            },
          ]),
        }),
      }),
    });

    const config = await resolvePhaseConfig({ boardId: 'board-1', listId: 'list-1' });
    expect(config).toEqual({
      serviceTierOverride: 'enterprise',
      autoRun: true,
      requiresHumanApproval: false,
    });
  });
});
