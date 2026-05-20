import type { StateTransitionAction, StateTransitionDirection, StateTransitionGraph, StateTransitionStyle } from './types';

const VALID_ACTIONS: StateTransitionAction[] = ['allowed_move_to'];
const VALID_DIRECTIONS: StateTransitionDirection[] = ['one_way', 'two_way'];
const VALID_STYLES: StateTransitionStyle[] = ['straight', 'orthogonal', 'smooth', 'curved'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function hasGraphCollections(value: unknown): value is {
  nodes: unknown[];
  edges: unknown[];
  notes: unknown[];
} {
  if (!isRecord(value)) return false;
  return Array.isArray(value.nodes) && Array.isArray(value.edges) && Array.isArray(value.notes);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function validateGraphShape(
  value: unknown,
): { ok: true; graph: StateTransitionGraph } | { ok: false; message: string } {
  if (!hasGraphCollections(value)) {
    return { ok: false, message: 'graph must include nodes, edges, and notes arrays' };
  }
  const { nodes, edges, notes } = value;

  const nodeIds = new Set<string>();
  const directionalEdges = new Set<string>();
  for (const node of nodes) {
    if (!isRecord(node)) return { ok: false, message: 'node must be an object' };
    if (typeof node.id !== 'string' || node.id.trim() === '') {
      return { ok: false, message: 'node.id must be a non-empty string' };
    }
    if (typeof node.listId !== 'string' || node.listId.trim() === '') {
      return { ok: false, message: 'node.listId must be a non-empty string' };
    }
    if (node.id !== node.listId) {
      return { ok: false, message: 'node.id must match node.listId' };
    }
    if (typeof node.label !== 'string') {
      return { ok: false, message: 'node.label must be a string' };
    }
    if (!isFiniteNumber(node.positionX) || !isFiniteNumber(node.positionY)) {
      return { ok: false, message: 'node.positionX and node.positionY must be finite numbers' };
    }
    if (nodeIds.has(node.id)) {
      return { ok: false, message: 'node.id must be unique' };
    }
    nodeIds.add(node.id);
  }

  for (const edge of edges) {
    if (!isRecord(edge)) return { ok: false, message: 'edge must be an object' };
    if (typeof edge.id !== 'string' || edge.id.trim() === '') {
      return { ok: false, message: 'edge.id must be a non-empty string' };
    }
    if (typeof edge.fromNodeId !== 'string' || typeof edge.toNodeId !== 'string') {
      return { ok: false, message: 'edge.fromNodeId and edge.toNodeId must be strings' };
    }
    if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) {
      return { ok: false, message: 'edge must reference existing node IDs' };
    }
    if (edge.fromNodeId === edge.toNodeId) {
      return { ok: false, message: 'edge self-connections are not allowed' };
    }
    if (!VALID_ACTIONS.includes(edge.action as StateTransitionAction)) {
      return { ok: false, message: 'edge.action is invalid' };
    }
    if (!VALID_DIRECTIONS.includes(edge.direction as StateTransitionDirection)) {
      return { ok: false, message: 'edge.direction is invalid' };
    }
    if (!VALID_STYLES.includes(edge.style as StateTransitionStyle)) {
      return { ok: false, message: 'edge.style is invalid' };
    }
    if (edge.sourceHandle !== undefined && typeof edge.sourceHandle !== 'string') {
      return { ok: false, message: 'edge.sourceHandle must be a string when provided' };
    }
    if (edge.targetHandle !== undefined && typeof edge.targetHandle !== 'string') {
      return { ok: false, message: 'edge.targetHandle must be a string when provided' };
    }
    if (edge.connectorOffsetX !== undefined && !isFiniteNumber(edge.connectorOffsetX)) {
      return { ok: false, message: 'edge.connectorOffsetX must be a finite number when provided' };
    }
    if (edge.connectorOffsetY !== undefined && !isFiniteNumber(edge.connectorOffsetY)) {
      return { ok: false, message: 'edge.connectorOffsetY must be a finite number when provided' };
    }
    if (edge.waypoints !== undefined) {
      if (!Array.isArray(edge.waypoints)) {
        return { ok: false, message: 'edge.waypoints must be an array when provided' };
      }
      for (const waypoint of edge.waypoints) {
        if (!isRecord(waypoint)) {
          return { ok: false, message: 'edge.waypoint must be an object' };
        }
        if (!isFiniteNumber(waypoint.x) || !isFiniteNumber(waypoint.y)) {
          return { ok: false, message: 'edge.waypoint x and y must be finite numbers' };
        }
      }
    }
    if (edge.label !== undefined && typeof edge.label !== 'string') {
      return { ok: false, message: 'edge.label must be a string when provided' };
    }

    const forwardKey = `${edge.fromNodeId}=>${edge.toNodeId}`;
    const reverseKey = `${edge.toNodeId}=>${edge.fromNodeId}`;
    if (directionalEdges.has(forwardKey)) {
      return { ok: false, message: 'duplicate directional edges are not allowed' };
    }
    directionalEdges.add(forwardKey);

    if (edge.direction === 'two_way') {
      if (directionalEdges.has(reverseKey)) {
        return { ok: false, message: 'duplicate directional edges are not allowed' };
      }
      directionalEdges.add(reverseKey);
    }
  }

  for (const note of notes) {
    if (!isRecord(note)) return { ok: false, message: 'note must be an object' };
    if (typeof note.id !== 'string' || note.id.trim() === '') {
      return { ok: false, message: 'note.id must be a non-empty string' };
    }
    if (typeof note.content !== 'string') {
      return { ok: false, message: 'note.content must be a string' };
    }
    if (!isFiniteNumber(note.positionX) || !isFiniteNumber(note.positionY)) {
      return { ok: false, message: 'note.positionX and note.positionY must be finite numbers' };
    }
  }

  return { ok: true, graph: value as unknown as StateTransitionGraph };
}

export function coerceLegacyGraphShape(value: unknown): StateTransitionGraph | null {
  if (!hasGraphCollections(value)) return null;
  const { nodes, edges, notes } = value;

  const normalizedNodes = nodes.filter((node): node is StateTransitionGraph['nodes'][number] => {
    if (!isRecord(node)) return false;
    return (
      typeof node.id === 'string'
      && node.id.trim() !== ''
      && typeof node.listId === 'string'
      && node.listId.trim() !== ''
      && typeof node.label === 'string'
      && isFiniteNumber(node.positionX)
      && isFiniteNumber(node.positionY)
    );
  });
  if (normalizedNodes.length !== nodes.length) return null;

  const nodeIds = new Set<string>();
  for (const node of normalizedNodes) {
    if (nodeIds.has(node.id)) return null;
    nodeIds.add(node.id);
  }

  const normalizedEdges = edges.filter((edge): edge is StateTransitionGraph['edges'][number] => {
    if (!isRecord(edge)) return false;
    if (typeof edge.id !== 'string' || edge.id.trim() === '') return false;
    if (typeof edge.fromNodeId !== 'string' || typeof edge.toNodeId !== 'string') return false;
    if (edge.fromNodeId === edge.toNodeId) return false;
    if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) return false;
    if (!VALID_ACTIONS.includes(edge.action as StateTransitionAction)) return false;
    if (!VALID_DIRECTIONS.includes(edge.direction as StateTransitionDirection)) return false;
    if (!VALID_STYLES.includes(edge.style as StateTransitionStyle)) return false;
    if (edge.sourceHandle !== undefined && typeof edge.sourceHandle !== 'string') return false;
    if (edge.targetHandle !== undefined && typeof edge.targetHandle !== 'string') return false;
    if (edge.connectorOffsetX !== undefined && !isFiniteNumber(edge.connectorOffsetX)) return false;
    if (edge.connectorOffsetY !== undefined && !isFiniteNumber(edge.connectorOffsetY)) return false;
    if (edge.waypoints !== undefined) {
      if (!Array.isArray(edge.waypoints)) return false;
      for (const waypoint of edge.waypoints) {
        if (!isRecord(waypoint)) return false;
        if (!isFiniteNumber(waypoint.x) || !isFiniteNumber(waypoint.y)) return false;
      }
    }
    return edge.label === undefined || typeof edge.label === 'string';
  });
  if (normalizedEdges.length !== edges.length) return null;

  const normalizedNotes = notes.filter((note): note is StateTransitionGraph['notes'][number] => {
    if (!isRecord(note)) return false;
    return (
      typeof note.id === 'string'
      && note.id.trim() !== ''
      && typeof note.content === 'string'
      && isFiniteNumber(note.positionX)
      && isFiniteNumber(note.positionY)
    );
  });
  if (normalizedNotes.length !== notes.length) return null;

  return {
    nodes: normalizedNodes,
    edges: normalizedEdges,
    notes: normalizedNotes,
  };
}

export function findUnknownNodeListId(graph: StateTransitionGraph, knownListIds: Set<string>): string | null {
  for (const node of graph.nodes) {
    if (!knownListIds.has(node.listId)) {
      return node.id;
    }
  }
  return null;
}

export function findMissingNodeForBoardList(graph: StateTransitionGraph, knownListIds: Set<string>): string | null {
  const graphListIds = new Set(graph.nodes.map((node) => node.listId));
  for (const listId of knownListIds) {
    if (!graphListIds.has(listId)) {
      return listId;
    }
  }
  return null;
}

export function findOutOfSyncNodeLabel(
  graph: StateTransitionGraph,
  listsById: Map<string, { id: string; title: string }>,
): { nodeId: string; listId: string; expectedLabel: string; receivedLabel: string } | null {
  for (const node of graph.nodes) {
    const list = listsById.get(node.listId);
    if (!list) continue;
    if (node.label !== list.title) {
      return {
        nodeId: node.id,
        listId: node.listId,
        expectedLabel: list.title,
        receivedLabel: node.label,
      };
    }
  }
  return null;
}
