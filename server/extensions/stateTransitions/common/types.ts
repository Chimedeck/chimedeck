export type StateTransitionAction = 'allowed_move_to';
export type StateTransitionDirection = 'one_way' | 'two_way';
export type StateTransitionStyle = 'straight' | 'curved';

export interface StateTransitionListLike {
  id: string;
  title: string;
}

export type StateTransitionListSyncReason = 'list-renamed' | 'list-deleted';

export interface StateTransitionListSyncResult {
  boardId: string;
  reason: StateTransitionListSyncReason;
  updated: boolean;
}

export interface StateTransitionGraphSyncResult {
  graph: StateTransitionGraph;
  changed: boolean;
}

export interface StateTransitionGraph {
  nodes: StateTransitionNode[];
  edges: StateTransitionEdge[];
  notes: StateTransitionNote[];
}

export interface StateTransitionNode {
  id: string;
  listId: string;
  label: string;
  positionX: number;
  positionY: number;
}

export interface StateTransitionEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  action: StateTransitionAction;
  direction: StateTransitionDirection;
  style: StateTransitionStyle;
  label?: string;
}

export interface StateTransitionNote {
  id: string;
  content: string;
  positionX: number;
  positionY: number;
}

export interface StateTransitionRule {
  current_state: string;
  current_state_id: string;
  allowed_next_states: string[];
  allowed_next_state_ids: string[];
  forbidden_next_states: string[];
  forbidden_next_state_ids: string[];
}

export interface StateTransitionAllowedNextState {
  id: string;
  name: string;
}

export interface StateTransitionUpdatedEvent {
  type: 'state_transition_updated';
  board_id: string;
  payload: {
    enabled: boolean;
    graph: StateTransitionGraph;
  };
  actor_id: string;
  timestamp: string;
}
