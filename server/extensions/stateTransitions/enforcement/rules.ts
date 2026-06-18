import { db } from '../../../common/db';
import { deriveRulesFromGraph } from '../common/serializer';
import { syncGraphWithLists } from '../common/sync';
import type {
  StateTransitionAllowedNextState,
  StateTransitionGraph,
  StateTransitionRule,
  StateTransitionUpdatedEvent,
} from '../common/types';
import { validateGraphShape } from '../common/validator';

const CACHE_TTL_MS = 60_000;

type TransitionRow = {
  board_id: string;
  enabled: boolean;
  graph_data: unknown;
};

export type BoardTransitionRules = {
  enabled: boolean;
  hasStateTransitionRow: boolean;
  rules: StateTransitionRule[];
  listNameById: Map<string, string>;
  allowedNextStatesByListId: Map<string, StateTransitionAllowedNextState[]>;
};

type CacheEntry = {
  expiresAt: number;
  rules: BoardTransitionRules;
};

const boardRulesCache = new Map<string, CacheEntry>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function coerceLegacyGraph(value: unknown): StateTransitionGraph | null {
  if (!isRecord(value)) return null;
  const { nodes, edges, notes } = value;
  if (!Array.isArray(nodes) || !Array.isArray(edges) || !Array.isArray(notes)) return null;

  const normalizedNodes = nodes.filter((node): node is StateTransitionGraph['nodes'][number] => {
    if (!isRecord(node)) return false;
    return (
      typeof node.id === 'string' &&
      node.id.trim() !== '' &&
      typeof node.listId === 'string' &&
      node.listId.trim() !== '' &&
      typeof node.label === 'string' &&
      isFiniteNumber(node.positionX) &&
      isFiniteNumber(node.positionY)
    );
  });
  const nodeIds = new Set(normalizedNodes.map((node) => node.id));

  const normalizedEdges = edges.filter((edge): edge is StateTransitionGraph['edges'][number] => {
    if (!isRecord(edge)) return false;
    if (typeof edge.id !== 'string' || edge.id.trim() === '') return false;
    if (typeof edge.fromNodeId !== 'string' || typeof edge.toNodeId !== 'string') return false;
    if (edge.fromNodeId === edge.toNodeId) return false;
    if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) return false;
    if (edge.action !== 'allowed_move_to') return false;
    if (edge.direction !== 'one_way' && edge.direction !== 'two_way') return false;
    if (edge.style !== 'straight' && edge.style !== 'curved') return false;
    return edge.label === undefined || typeof edge.label === 'string';
  });

  const normalizedNotes = notes.filter((note): note is StateTransitionGraph['notes'][number] => {
    if (!isRecord(note)) return false;
    return (
      typeof note.id === 'string' &&
      note.id.trim() !== '' &&
      typeof note.content === 'string' &&
      isFiniteNumber(note.positionX) &&
      isFiniteNumber(note.positionY)
    );
  });

  return {
    nodes: normalizedNodes,
    edges: normalizedEdges,
    notes: normalizedNotes,
  };
}

function createEmptyRules({
  enabled,
  hasStateTransitionRow,
}: {
  enabled: boolean;
  hasStateTransitionRow: boolean;
}): BoardTransitionRules {
  return {
    enabled,
    hasStateTransitionRow,
    rules: [],
    listNameById: new Map<string, string>(),
    allowedNextStatesByListId: new Map<string, StateTransitionAllowedNextState[]>(),
  };
}

function deriveBoardRules({
  enabled,
  graph,
}: {
  enabled: boolean;
  graph: StateTransitionGraph;
}): BoardTransitionRules {
  const rules = deriveRulesFromGraph(graph);
  const listNameById = new Map(graph.nodes.map((node) => [node.listId, node.label]));
  const allowedNextStatesByListId = new Map<string, StateTransitionAllowedNextState[]>();

  for (const rule of rules) {
    const allowedNextStates = rule.allowed_next_state_ids.map((id) => ({
      id,
      name: listNameById.get(id) ?? id,
    }));
    allowedNextStatesByListId.set(rule.current_state_id, allowedNextStates);
  }

  return {
    enabled,
    hasStateTransitionRow: true,
    rules,
    listNameById,
    allowedNextStatesByListId,
  };
}

export async function getRulesForBoard(boardId: string): Promise<BoardTransitionRules> {
  const now = Date.now();
  const cached = boardRulesCache.get(boardId);
  if (cached && cached.expiresAt > now) {
    return cached.rules;
  }

  const row = (await db('board_state_transitions').where({ board_id: boardId }).first()) as
    | TransitionRow
    | undefined;

  const activeLists = (await db('lists')
    .where({ board_id: boardId, archived: false })
    .orderBy('position', 'asc')
    .select('id', 'title')) as Array<{ id: string; title: string }>;

  const nextRules = (() => {
    if (!row) return createEmptyRules({ enabled: false, hasStateTransitionRow: false });
    const graphValidation = validateGraphShape(row.graph_data);
    const graph = graphValidation.ok ? graphValidation.graph : coerceLegacyGraph(row.graph_data);
    if (!graph) {
      return createEmptyRules({ enabled: false, hasStateTransitionRow: true });
    }
    const synced = syncGraphWithLists(graph, activeLists);
    return deriveBoardRules({ enabled: row.enabled, graph: synced.graph });
  })();

  boardRulesCache.set(boardId, {
    expiresAt: now + CACHE_TTL_MS,
    rules: nextRules,
  });

  return nextRules;
}

export function invalidateRulesCacheForBoard(boardId: string): void {
  boardRulesCache.delete(boardId);
}

export function invalidateRulesCacheFromStateTransitionEvent(
  event: Pick<StateTransitionUpdatedEvent, 'type' | 'board_id'>
): void {
  if (event.type !== 'state_transition_updated') return;
  invalidateRulesCacheForBoard(event.board_id);
}

export function clearRulesCache(): void {
  boardRulesCache.clear();
}
