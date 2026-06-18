// Phase resolver — runtime access to workflow phase metadata on columns.
// Uses the same Map-based cache + TTL pattern as enforcement/rules.ts.
// Cache is invalidated on graph save (via WS event broadcast).

import { db } from '../../../../common/db';
import { validateGraphShape } from '../../common/validator';
import type {
  WorkflowPhase,
  PhaseConfig,
  StateTransitionGraph,
  StateTransitionUpdatedEvent,
} from '../../common/types';

const CACHE_TTL_MS = 60_000;

type TransitionRow = {
  board_id: string;
  graph_data: unknown;
};

type CacheEntry = {
  expiresAt: number;
  graph: StateTransitionGraph;
};

const boardGraphCache = new Map<string, CacheEntry>();

async function loadBoardGraph(boardId: string): Promise<StateTransitionGraph | null> {
  const row = (await db('board_state_transitions').where({ board_id: boardId }).first()) as
    | TransitionRow
    | undefined;

  if (!row) return null;

  const validation = validateGraphShape(row.graph_data);
  return validation.ok ? validation.graph : null;
}

async function getOrLoadBoardGraph(boardId: string): Promise<StateTransitionGraph | null> {
  const now = Date.now();
  const cached = boardGraphCache.get(boardId);
  if (cached && cached.expiresAt > now) {
    return cached.graph;
  }

  const graph = await loadBoardGraph(boardId);
  if (!graph) return null;

  boardGraphCache.set(boardId, { expiresAt: now + CACHE_TTL_MS, graph });
  return graph;
}

/**
 * Resolve the workflow phases configured for a specific list (column) on a board.
 * Returns an empty array if the column has no phases configured.
 */
export async function resolveColumnWorkflowPhases({
  boardId,
  listId,
}: {
  boardId: string;
  listId: string;
}): Promise<WorkflowPhase[]> {
  const graph = await getOrLoadBoardGraph(boardId);
  if (!graph) return [];

  const node = graph.nodes.find((n) => n.listId === listId);
  return node?.workflowPhases ?? [];
}

/**
 * Resolve the phase-specific configuration for a column on a board.
 * Returns the phaseConfig from the node if present, otherwise default config.
 */
export async function resolvePhaseConfig({
  boardId,
  listId,
}: {
  boardId: string;
  listId: string;
  phase?: WorkflowPhase;
}): Promise<PhaseConfig> {
  const graph = await getOrLoadBoardGraph(boardId);
  const defaultConfig: PhaseConfig = {
    serviceTierOverride: null,
    autoRun: false,
    requiresHumanApproval: true,
  };

  if (!graph) return defaultConfig;

  const node = graph.nodes.find((n) => n.listId === listId);
  if (!node || !node.phaseConfig) return defaultConfig;

  return {
    serviceTierOverride: node.phaseConfig.serviceTierOverride ?? null,
    autoRun: node.phaseConfig.autoRun ?? false,
    requiresHumanApproval: node.phaseConfig.requiresHumanApproval ?? true,
  };
}

/**
 * Invalidate the cached board graph — called after a graph save.
 */
export function invalidatePhaseCacheForBoard(boardId: string): void {
  boardGraphCache.delete(boardId);
}

/**
 * Listener for WS events — invalidates cache when state transitions are updated.
 */
export function invalidatePhaseCacheFromStateTransitionEvent(
  event: Pick<StateTransitionUpdatedEvent, 'type' | 'board_id'>
): void {
  if (event.type !== 'state_transition_updated') return;
  invalidatePhaseCacheForBoard(event.board_id);
}
