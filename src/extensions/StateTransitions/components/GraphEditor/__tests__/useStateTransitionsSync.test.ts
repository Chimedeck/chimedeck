import { describe, expect, it } from 'bun:test';
import type { StateTransitionGraph } from '../../../api';
import { applyRemoteGraphMerge, shouldIgnoreStateTransitionEcho } from '../useStateTransitionsSync';

const localGraph: StateTransitionGraph = {
  nodes: [
    { id: 'todo', listId: 'todo', label: 'Todo', positionX: 50, positionY: 80 },
    { id: 'doing', listId: 'doing', label: 'Doing', positionX: 220, positionY: 80 },
    { id: 'local-new', listId: 'local-new', label: 'Local', positionX: 400, positionY: 100 },
  ],
  edges: [
    {
      id: 'e-local',
      fromNodeId: 'todo',
      toNodeId: 'doing',
      action: 'allowed_move_to',
      direction: 'one_way',
      style: 'straight',
    },
  ],
  notes: [{ id: 'n-local', content: 'local note', positionX: 10, positionY: 10 }],
};

const remoteGraph: StateTransitionGraph = {
  nodes: [
    { id: 'todo', listId: 'todo', label: 'To do (remote)', positionX: 90, positionY: 120 },
    { id: 'doing', listId: 'doing', label: 'Doing', positionX: 280, positionY: 140 },
  ],
  edges: [
    {
      id: 'e-remote',
      fromNodeId: 'doing',
      toNodeId: 'todo',
      action: 'allowed_move_to',
      direction: 'two_way',
      style: 'curved',
    },
  ],
  notes: [{ id: 'n-remote', content: 'remote note', positionX: 300, positionY: 300 }],
};

describe('useStateTransitionsSync helpers', () => {
  it('ignores own echoes only when actor_id matches current user', () => {
    expect(shouldIgnoreStateTransitionEcho({ actorId: 'u-1', currentUserId: 'u-1' })).toBe(true);
    expect(shouldIgnoreStateTransitionEcho({ actorId: 'u-2', currentUserId: 'u-1' })).toBe(false);
    expect(shouldIgnoreStateTransitionEcho({ actorId: undefined, currentUserId: 'u-1' })).toBe(
      false
    );
  });

  it('merges remote graph with LWW edges/notes and keeps recent local nodes', () => {
    const localOnlyNode = localGraph.nodes[2];
    if (!localOnlyNode) throw new Error('Expected local graph to include local-only node');

    const merged = applyRemoteGraphMerge({
      localGraph,
      remoteGraph,
      recentLocalNodeIds: new Set(['local-new']),
    });

    expect(merged.edges).toEqual(remoteGraph.edges);
    expect(merged.notes).toEqual(remoteGraph.notes);
    expect(merged.nodes).toEqual([...remoteGraph.nodes, localOnlyNode]);
  });

  it('drops stale local-only nodes when they are not recent', () => {
    const merged = applyRemoteGraphMerge({
      localGraph,
      remoteGraph,
      recentLocalNodeIds: new Set(),
    });

    expect(merged.nodes).toEqual(remoteGraph.nodes);
  });
});
