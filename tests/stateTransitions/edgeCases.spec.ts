import { describe, expect, it } from 'bun:test';
import { validateGraphShape } from '../../server/extensions/stateTransitions/common/validator';
import { createDefaultGraphFromLists } from '../../server/extensions/stateTransitions/common/serializer';
import { stateTransitionError } from '../../server/extensions/stateTransitions/common/errors';
import {
  buildStateTransitionGuardSnapshot,
  canMoveWithSnapshot,
} from '../../src/extensions/StateTransitions/hooks/useStateTransitionGuard';

describe('state transitions edge cases', () => {
  it('rejects invalid graph shape for duplicate directional edges and self-connections', () => {
    const duplicateEdgeGraph = {
      nodes: [
        { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 0, positionY: 0 },
        { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 100, positionY: 0 },
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
          fromNodeId: 'list-1',
          toNodeId: 'list-2',
          action: 'allowed_move_to',
          direction: 'one_way',
          style: 'straight',
        },
      ],
      notes: [],
    };
    const selfEdgeGraph = {
      ...duplicateEdgeGraph,
      edges: [
        {
          id: 'edge-self',
          fromNodeId: 'list-1',
          toNodeId: 'list-1',
          action: 'allowed_move_to',
          direction: 'one_way',
          style: 'curved',
        },
      ],
    };

    const duplicateResult = validateGraphShape(duplicateEdgeGraph);
    const selfResult = validateGraphShape(selfEdgeGraph);

    expect(duplicateResult.ok).toBe(false);
    if (!duplicateResult.ok) {
      expect(duplicateResult.message).toContain('duplicate directional edges');
    }
    expect(selfResult.ok).toBe(false);
    if (!selfResult.ok) {
      expect(selfResult.message).toContain('self-connections');
    }
  });

  it('creates deterministic default graph node positions from board lists', () => {
    const graph = createDefaultGraphFromLists([
      { id: 'list-a', title: 'Backlog' },
      { id: 'list-b', title: 'In Progress' },
      { id: 'list-c', title: 'Done' },
    ]);

    expect(graph.nodes).toEqual([
      expect.objectContaining({ id: 'list-a', listId: 'list-a', positionX: 120, positionY: 80 }),
      expect.objectContaining({ id: 'list-b', listId: 'list-b', positionX: 360, positionY: 80 }),
      expect.objectContaining({ id: 'list-c', listId: 'list-c', positionX: 600, positionY: 80 }),
    ]);
    expect(graph.edges).toEqual([]);
    expect(graph.notes).toEqual([]);
  });

  it('fails open for unknown source list IDs and fails closed for known forbidden transitions', () => {
    const snapshot = buildStateTransitionGuardSnapshot({
      stateTransitionsFeatureEnabled: true,
      boardEnforced: true,
      rules: [
        {
          currentState: 'Todo',
          currentStateId: 'list-1',
          allowedNextStates: ['Doing'],
          allowedNextStateIds: ['list-2'],
          forbiddenNextStates: ['Done'],
          forbiddenNextStateIds: ['list-3'],
        },
      ],
      knownLists: [
        { id: 'list-1', title: 'Todo' },
        { id: 'list-2', title: 'Doing' },
        { id: 'list-3', title: 'Done' },
      ],
    });

    expect(canMoveWithSnapshot(snapshot, 'unknown-list', 'list-3')).toBe(true);
    expect(canMoveWithSnapshot(snapshot, 'list-1', 'list-3')).toBe(false);
  });

  it('returns canonical error envelope shape', () => {
    expect(stateTransitionError('state-transition-node-unknown-list', { nodeId: 'list-99' })).toEqual({
      name: 'state-transition-node-unknown-list',
      data: { nodeId: 'list-99' },
    });
    expect(stateTransitionError('state-transition-copy-no-source')).toEqual({
      name: 'state-transition-copy-no-source',
    });
  });
});
