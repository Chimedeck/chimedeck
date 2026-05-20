import { describe, expect, it } from 'bun:test';
import { toGraphResponse, toRulesResponse } from '../serializer';
import type { StateTransitionGraph } from '../types';

describe('stateTransitions rules serializer', () => {
  it('strips unknown fields from graph response payload', () => {
    const nodeWithExtra = {
      id: 'list-1',
      listId: 'list-1',
      label: 'Todo',
      positionX: 0,
      positionY: 0,
      extra: 'x',
    };

    const response = toGraphResponse({
      boardId: 'board-1',
      enabled: true,
      updatedAt: '2026-05-19T10:00:00.000Z',
      graph: {
        nodes: [nodeWithExtra],
        edges: [],
        notes: [],
      },
    });

    expect(response.data.graph.nodes).toEqual([
      {
        id: 'list-1',
        listId: 'list-1',
        label: 'Todo',
        positionX: 0,
        positionY: 0,
      },
    ]);
  });

  it('returns an empty rules array for graphs with no outgoing edges', () => {
    const graph: StateTransitionGraph = {
      nodes: [
        { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 0, positionY: 0 },
        { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 1, positionY: 0 },
      ],
      edges: [],
      notes: [],
    };

    const response = toRulesResponse({ boardId: 'board-1', enabled: true, graph });
    expect(response.data.rules).toEqual([]);
  });

  it('builds allowed and forbidden lists from graph edges', () => {
    const graph: StateTransitionGraph = {
      nodes: [
        { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 0, positionY: 0 },
        { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 1, positionY: 0 },
        { id: 'list-3', listId: 'list-3', label: 'Done', positionX: 2, positionY: 0 },
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
      ],
      notes: [],
    };

    const response = toRulesResponse({ boardId: 'board-1', enabled: true, graph });
    expect(response.data.rules).toEqual([
      {
        current_state: 'Todo',
        current_state_id: 'list-1',
        allowed_next_states: ['Doing'],
        allowed_next_state_ids: ['list-2'],
        forbidden_next_states: ['Done'],
        forbidden_next_state_ids: ['list-3'],
      },
    ]);
  });

  it('uses listId for rule identifiers when node IDs are custom', () => {
    const graph: StateTransitionGraph = {
      nodes: [
        { id: 'node-a', listId: 'list-1', label: 'Todo', positionX: 0, positionY: 0 },
        { id: 'node-b', listId: 'list-2', label: 'Doing', positionX: 1, positionY: 0 },
      ],
      edges: [
        {
          id: 'edge-1',
          fromNodeId: 'node-a',
          toNodeId: 'node-b',
          action: 'allowed_move_to',
          direction: 'one_way',
          style: 'curved',
        },
      ],
      notes: [],
    };

    const response = toRulesResponse({ boardId: 'board-1', enabled: true, graph });
    expect(response.data.rules).toEqual([
      {
        current_state: 'Todo',
        current_state_id: 'list-1',
        allowed_next_states: ['Doing'],
        allowed_next_state_ids: ['list-2'],
        forbidden_next_states: [],
        forbidden_next_state_ids: [],
      },
    ]);
  });

  it('derives two-way edges as allowed transitions for both connected nodes', () => {
    const graph: StateTransitionGraph = {
      nodes: [
        { id: 'list-1', listId: 'list-1', label: 'Todo', positionX: 0, positionY: 0 },
        { id: 'list-2', listId: 'list-2', label: 'Doing', positionX: 1, positionY: 0 },
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
      ],
      notes: [],
    };

    const response = toRulesResponse({ boardId: 'board-1', enabled: true, graph });
    expect(response.data.rules).toEqual([
      {
        current_state: 'Todo',
        current_state_id: 'list-1',
        allowed_next_states: ['Doing'],
        allowed_next_state_ids: ['list-2'],
        forbidden_next_states: [],
        forbidden_next_state_ids: [],
      },
      {
        current_state: 'Doing',
        current_state_id: 'list-2',
        allowed_next_states: ['Todo'],
        allowed_next_state_ids: ['list-1'],
        forbidden_next_states: [],
        forbidden_next_state_ids: [],
      },
    ]);
  });
});
