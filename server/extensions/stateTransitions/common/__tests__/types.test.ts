import { describe, expect, it } from 'bun:test';
import type {
  StateTransitionAllowedNextState,
  StateTransitionGraphSyncResult,
  StateTransitionRule,
  StateTransitionUpdatedEvent,
} from '../types';

describe('stateTransitions types', () => {
  it('supports the normalized rule payload contract', () => {
    const rule: StateTransitionRule = {
      current_state: 'Todo',
      current_state_id: 'list-1',
      allowed_next_states: ['Doing'],
      allowed_next_state_ids: ['list-2'],
      forbidden_next_states: ['Done'],
      forbidden_next_state_ids: ['list-3'],
    };

    expect(rule.current_state_id).toBe('list-1');
    expect(rule.allowed_next_state_ids).toEqual(['list-2']);
  });

  it('supports the websocket update payload contract', () => {
    const event: StateTransitionUpdatedEvent = {
      type: 'state_transition_updated',
      board_id: 'board-1',
      actor_id: 'user-1',
      timestamp: new Date('2026-05-19T00:00:00.000Z').toISOString(),
      payload: {
        enabled: true,
        graph: { nodes: [], edges: [], notes: [] },
      },
    };

    expect(event.type).toBe('state_transition_updated');
    expect(event.payload.enabled).toBe(true);
  });

  it('supports allowed-next-state payloads with id and name', () => {
    const allowed: StateTransitionAllowedNextState = {
      id: 'list-2',
      name: 'Doing',
    };

    expect(allowed.id).toBe('list-2');
    expect(allowed.name).toBe('Doing');
  });

  it('supports graph sync result payloads', () => {
    const result: StateTransitionGraphSyncResult = {
      changed: true,
      graph: {
        nodes: [],
        edges: [],
        notes: [],
      },
    };

    expect(result.changed).toBe(true);
    expect(result.graph.nodes).toEqual([]);
  });
});
