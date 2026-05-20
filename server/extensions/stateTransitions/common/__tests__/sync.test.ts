import { describe, expect, it } from 'bun:test';
import { renameNodeLabel, stripDeletedNodes } from '../sync';
import type { StateTransitionGraph } from '../types';

const sampleGraph: StateTransitionGraph = {
  nodes: [
    { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 10, positionY: 20 },
    { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 30, positionY: 20 },
    { id: 'list-3', listId: 'list-3', label: 'Done', positionX: 50, positionY: 20 },
  ],
  edges: [
    {
      id: 'edge-1',
      fromNodeId: 'list-1',
      toNodeId: 'list-2',
      action: 'allowed_move_to',
      direction: 'one_way',
      style: 'curved',
    },
    {
      id: 'edge-2',
      fromNodeId: 'list-2',
      toNodeId: 'list-3',
      action: 'allowed_move_to',
      direction: 'one_way',
      style: 'curved',
    },
  ],
  notes: [{ id: 'note-1', content: 'test', positionX: 1, positionY: 2 }],
};

describe('stateTransitions sync helpers', () => {
  it('stripDeletedNodes removes stale nodes and edges referencing them', () => {
    const synced = stripDeletedNodes(sampleGraph, [
      { id: 'list-1', title: 'Todo' },
      { id: 'list-3', title: 'Done' },
    ]);

    expect(synced.nodes.map((node) => node.id)).toEqual(['list-1', 'list-3']);
    expect(synced.edges).toEqual([]);
    expect(synced.notes).toHaveLength(1);
  });

  it('renameNodeLabel updates renamed labels', () => {
    const graph = renameNodeLabel(sampleGraph, [
      { id: 'list-1', title: 'Todo renamed' },
      { id: 'list-2', title: 'Doing' },
      { id: 'list-3', title: 'Done' },
    ]);

    expect(graph.nodes.find((node) => node.id === 'list-1')?.label).toBe('Todo renamed');
  });
});
