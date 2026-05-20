import { describe, expect, it } from 'bun:test';
import { stripDeletedNodes } from '../sync';
import type { StateTransitionGraph } from '../types';

describe('stateTransitions sync edge cases', () => {
  it('removes all edges referencing a deleted node even when multiple edges touch it', () => {
    const graph: StateTransitionGraph = {
      nodes: [
        { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 0, positionY: 0 },
        { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 1, positionY: 0 },
        { id: 'list-3', listId: 'list-3', label: 'Done', positionX: 2, positionY: 0 },
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
        {
          id: 'edge-b',
          fromNodeId: 'list-2',
          toNodeId: 'list-3',
          action: 'allowed_move_to',
          direction: 'one_way',
          style: 'curved',
        },
        {
          id: 'edge-c',
          fromNodeId: 'list-3',
          toNodeId: 'list-2',
          action: 'allowed_move_to',
          direction: 'one_way',
          style: 'straight',
        },
      ],
      notes: [],
    };

    const synced = stripDeletedNodes(graph, [
      { id: 'list-1', title: 'Todo' },
      { id: 'list-3', title: 'Done' },
    ]);

    expect(synced.nodes.map((node) => node.id)).toEqual(['list-1', 'list-3']);
    expect(synced.edges).toEqual([]);
  });
});
