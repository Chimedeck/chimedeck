import { describe, expect, it } from 'bun:test';
import {
  findMissingNodeForBoardList,
  findOutOfSyncNodeLabel,
  findUnknownNodeListId,
  validateGraphShape,
} from '../validator';
import type { StateTransitionGraph } from '../types';

describe('stateTransitions validator', () => {
  it('rejects nodes where id and listId do not match', () => {
    const result = validateGraphShape({
      nodes: [{ id: 'node-1', listId: 'list-1', label: 'Todo', positionX: 1, positionY: 2 }],
      edges: [],
      notes: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe('node.id must match node.listId');
    }
  });

  it('findUnknownNodeListId reports nodes for lists deleted from the board', () => {
    const graph: StateTransitionGraph = {
      nodes: [
        { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 1, positionY: 2 },
        { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 3, positionY: 4 },
      ],
      edges: [],
      notes: [],
    };

    const unknownNodeId = findUnknownNodeListId(graph, new Set(['list-1']));
    expect(unknownNodeId).toBe('list-2');
  });

  it('findMissingNodeForBoardList reports lists that are not represented in graph nodes', () => {
    const graph: StateTransitionGraph = {
      nodes: [
        { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 1, positionY: 2 },
      ],
      edges: [],
      notes: [],
    };

    const missingListId = findMissingNodeForBoardList(graph, new Set(['list-1', 'list-2']));
    expect(missingListId).toBe('list-2');
  });

  it('rejects self-referencing edges', () => {
    const result = validateGraphShape({
      nodes: [{ id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 1, positionY: 2 }],
      edges: [
        {
          id: 'edge-1',
          fromNodeId: 'list-1',
          toNodeId: 'list-1',
          action: 'allowed_move_to',
          direction: 'one_way',
          style: 'straight',
        },
      ],
      notes: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe('edge self-connections are not allowed');
    }
  });

  it('rejects duplicate directional edges', () => {
    const result = validateGraphShape({
      nodes: [
        { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 1, positionY: 2 },
        { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 3, positionY: 4 },
      ],
      edges: [
        {
          id: 'edge-1',
          fromNodeId: 'list-1',
          toNodeId: 'list-2',
          action: 'allowed_move_to',
          direction: 'one_way',
          style: 'straight',
        },
        {
          id: 'edge-2',
          fromNodeId: 'list-1',
          toNodeId: 'list-2',
          action: 'allowed_move_to',
          direction: 'one_way',
          style: 'curved',
        },
      ],
      notes: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe('duplicate directional edges are not allowed');
    }
  });

  it('rejects one-way edges that duplicate a two-way directional relationship', () => {
    const result = validateGraphShape({
      nodes: [
        { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 1, positionY: 2 },
        { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 3, positionY: 4 },
      ],
      edges: [
        {
          id: 'edge-1',
          fromNodeId: 'list-1',
          toNodeId: 'list-2',
          action: 'allowed_move_to',
          direction: 'two_way',
          style: 'straight',
        },
        {
          id: 'edge-2',
          fromNodeId: 'list-2',
          toNodeId: 'list-1',
          action: 'allowed_move_to',
          direction: 'one_way',
          style: 'curved',
        },
      ],
      notes: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe('duplicate directional edges are not allowed');
    }
  });

  it('findOutOfSyncNodeLabel reports first node label mismatch', () => {
    const graph: StateTransitionGraph = {
      nodes: [
        { id: 'list-1', listId: 'list-1', label: 'Todo old', positionX: 1, positionY: 2 },
        { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 3, positionY: 4 },
      ],
      edges: [],
      notes: [],
    };

    const mismatch = findOutOfSyncNodeLabel(
      graph,
      new Map([
        ['list-1', { id: 'list-1', title: 'Todo' }],
        ['list-2', { id: 'list-2', title: 'Doing' }],
      ]),
    );

    expect(mismatch).toEqual({
      nodeId: 'list-1',
      listId: 'list-1',
      expectedLabel: 'Todo',
      receivedLabel: 'Todo old',
    });
  });
});
