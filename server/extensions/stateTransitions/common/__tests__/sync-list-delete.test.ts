import { describe, expect, it } from 'bun:test';
import { stripDeletedNodes } from '../sync';
import type { StateTransitionGraph } from '../types';

describe('stateTransitions sync list delete', () => {
  it('keeps notes while deleting stale nodes and connected edges', () => {
    const graph: StateTransitionGraph = {
      nodes: [
        { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 0, positionY: 0 },
        { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 1, positionY: 0 },
      ],
      edges: [
        {
          id: 'edge-a',
          fromNodeId: 'list-1',
          toNodeId: 'list-2',
          action: 'allowed_move_to',
          direction: 'one_way',
          style: 'curved',
        },
      ],
      notes: [{ id: 'note-1', content: 'keep me', positionX: 8, positionY: 9 }],
    };

    const synced = stripDeletedNodes(graph, [{ id: 'list-1', title: 'Todo' }]);
    expect(synced.nodes).toEqual([expect.objectContaining({ id: 'list-1' })]);
    expect(synced.edges).toEqual([]);
    expect(synced.notes).toEqual([{ id: 'note-1', content: 'keep me', positionX: 8, positionY: 9 }]);
  });
});
