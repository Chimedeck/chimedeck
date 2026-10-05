import { describe, expect, it } from 'bun:test';
import type { StateTransitionGraph } from '../../../api';
import { resolveRemoteMerge } from '../useGraphEditor';

const localGraph: StateTransitionGraph = {
  nodes: [
    { id: 'todo', listId: 'todo', label: 'Todo', positionX: 80, positionY: 120 },
    { id: 'doing', listId: 'doing', label: 'Doing', positionX: 320, positionY: 120 },
    { id: 'new-local', listId: 'new-local', label: 'New local', positionX: 600, positionY: 120 },
  ],
  edges: [
    {
      id: 'edge-local',
      fromNodeId: 'todo',
      toNodeId: 'doing',
      action: 'allowed_move_to',
      direction: 'one_way',
      style: 'straight',
    },
  ],
  notes: [{ id: 'note-local', content: 'local', positionX: 20, positionY: 20 }],
};

const remoteGraph: StateTransitionGraph = {
  nodes: [
    { id: 'todo', listId: 'todo', label: 'To do (remote)', positionX: 120, positionY: 180 },
    { id: 'doing', listId: 'doing', label: 'Doing', positionX: 440, positionY: 180 },
  ],
  edges: [
    {
      id: 'edge-remote',
      fromNodeId: 'doing',
      toNodeId: 'todo',
      action: 'allowed_move_to',
      direction: 'two_way',
      style: 'curved',
    },
  ],
  notes: [{ id: 'note-remote', content: 'remote', positionX: 420, positionY: 220 }],
};

describe('resolveRemoteMerge', () => {
  it('uses remote LWW merge and resets undo history contract', () => {
    const localOnlyNode = localGraph.nodes[2];
    if (!localOnlyNode) throw new Error('Expected local graph to contain local-only node');

    const result = resolveRemoteMerge({
      localGraph,
      remoteGraph,
      recentLocalNodeIds: new Set(['new-local']),
    });

    expect(result.shouldResetUndoHistory).toBe(true);
    expect(result.mergedGraph.edges).toEqual(remoteGraph.edges);
    expect(result.mergedGraph.notes).toEqual(remoteGraph.notes);
    expect(result.mergedGraph.nodes).toEqual([...remoteGraph.nodes, localOnlyNode]);
  });
});
