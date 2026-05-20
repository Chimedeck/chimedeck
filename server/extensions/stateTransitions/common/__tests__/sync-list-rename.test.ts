import { describe, expect, it } from 'bun:test';
import { updateNodeLabels } from '../sync';
import type { StateTransitionGraph } from '../types';

describe('stateTransitions sync list rename', () => {
  it('updates each node label to the latest list title even when titles duplicate', () => {
    const graph: StateTransitionGraph = {
      nodes: [
        { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 0, positionY: 0 },
        { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 1, positionY: 0 },
      ],
      edges: [],
      notes: [],
    };

    const synced = updateNodeLabels(graph, [
      { id: 'list-1', title: 'Review' },
      { id: 'list-2', title: 'Review' },
    ]);

    expect(synced.nodes).toEqual([
      expect.objectContaining({ id: 'list-1', label: 'Review' }),
      expect.objectContaining({ id: 'list-2', label: 'Review' }),
    ]);
  });
});
