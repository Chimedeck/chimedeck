import type {
  StateTransitionGraph,
  StateTransitionNode,
  StateTransitionRule,
} from './types';
import { validateGraphShape } from './validator';

type ListLike = {
  id: string;
  title: string;
};

type GraphResponseInput = {
  boardId: string;
  enabled: boolean;
  graph: StateTransitionGraph;
  updatedAt: string | Date | null | undefined;
};

type RulesResponseInput = {
  boardId: string;
  enabled: boolean;
  graph: StateTransitionGraph;
};

const NODE_START_X = 120;
const NODE_STEP_X = 240;
const NODE_Y = 80;

export function createEmptyGraph(): StateTransitionGraph {
  return { nodes: [], edges: [], notes: [] };
}

export function createDefaultGraphFromLists(lists: ListLike[]): StateTransitionGraph {
  const nodes: StateTransitionNode[] = lists.map((list, index) => ({
    id: list.id,
    listId: list.id,
    label: list.title,
    positionX: NODE_START_X + index * NODE_STEP_X,
    positionY: NODE_Y,
  }));

  return {
    nodes,
    edges: [],
    notes: [],
  };
}

export function serializeGraph(graph: StateTransitionGraph): StateTransitionGraph {
  return {
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      listId: node.listId,
      label: node.label,
      positionX: node.positionX,
      positionY: node.positionY,
    })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      action: edge.action,
      direction: edge.direction,
      style: edge.style,
      ...(edge.label === undefined ? {} : { label: edge.label }),
    })),
    notes: graph.notes.map((note) => ({
      id: note.id,
      content: note.content,
      positionX: note.positionX,
      positionY: note.positionY,
    })),
  };
}

export function deserializeGraphData(value: unknown): StateTransitionGraph | null {
  const graphValidation = validateGraphShape(value);
  return graphValidation.ok ? serializeGraph(graphValidation.graph) : null;
}

export function toGraphResponse({
  boardId,
  enabled,
  graph,
  updatedAt,
}: GraphResponseInput): { data: { boardId: string; enabled: boolean; graph: StateTransitionGraph; updatedAt: string } } {
  const normalizedUpdatedAt = updatedAt
    ? new Date(updatedAt).toISOString()
    : new Date().toISOString();

  return {
    data: {
      boardId,
      enabled,
      graph: serializeGraph(graph),
      updatedAt: normalizedUpdatedAt,
    },
  };
}

export function deriveRulesFromGraph(graph: StateTransitionGraph): StateTransitionRule[] {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const labelByListId = new Map(graph.nodes.map((node) => [node.listId, node.label]));
  const rules: StateTransitionRule[] = [];

  for (const node of graph.nodes) {
    const allowedListIds = new Set<string>();
    for (const edge of graph.edges) {
      if (edge.direction === 'one_way' && edge.fromNodeId === node.id && nodeById.has(edge.toNodeId)) {
        const toNode = nodeById.get(edge.toNodeId);
        if (toNode) allowedListIds.add(toNode.listId);
        continue;
      }

      if (edge.direction === 'two_way') {
        if (edge.fromNodeId === node.id && nodeById.has(edge.toNodeId)) {
          const toNode = nodeById.get(edge.toNodeId);
          if (toNode) allowedListIds.add(toNode.listId);
        } else if (edge.toNodeId === node.id && nodeById.has(edge.fromNodeId)) {
          const fromNode = nodeById.get(edge.fromNodeId);
          if (fromNode) allowedListIds.add(fromNode.listId);
        }
      }
    }

    if (allowedListIds.size === 0) continue;

    const allowed_next_state_ids = Array.from(allowedListIds);
    const allowed_next_states = allowed_next_state_ids
      .map((id) => labelByListId.get(id))
      .filter((label): label is string => typeof label === 'string');

    const forbiddenNodes = graph.nodes.filter(
      (candidate) => candidate.listId !== node.listId && !allowedListIds.has(candidate.listId),
    );

    rules.push({
      current_state: node.label,
      current_state_id: node.listId,
      allowed_next_states,
      allowed_next_state_ids,
      forbidden_next_states: forbiddenNodes.map((candidate) => candidate.label),
      forbidden_next_state_ids: forbiddenNodes.map((candidate) => candidate.listId),
    });
  }

  return rules;
}

export function toRulesResponse({
  boardId,
  enabled,
  graph,
}: RulesResponseInput): { data: { boardId: string; enabled: boolean; rules: StateTransitionRule[] } } {
  return {
    data: {
      boardId,
      enabled,
      rules: deriveRulesFromGraph(serializeGraph(graph)),
    },
  };
}
