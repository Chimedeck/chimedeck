import type {
  StateTransitionGraph,
  StateTransitionGraphSyncResult,
  StateTransitionListLike,
} from './types';

export function stripDeletedNodes(
  graphData: StateTransitionGraph,
  activeLists: StateTransitionListLike[],
): StateTransitionGraph {
  const activeListIds = new Set(activeLists.map((list) => list.id));
  const nodes = graphData.nodes.filter((node) => activeListIds.has(node.listId));
  const activeNodeIds = new Set(nodes.map((node) => node.id));
  const edges = graphData.edges.filter(
    (edge) => activeNodeIds.has(edge.fromNodeId) && activeNodeIds.has(edge.toNodeId),
  );

  return {
    nodes,
    edges,
    notes: graphData.notes.map((note) => ({ ...note })),
  };
}

export function renameNodeLabel(
  graphData: StateTransitionGraph,
  activeLists: StateTransitionListLike[],
): StateTransitionGraph {
  const titleByListId = new Map(activeLists.map((list) => [list.id, list.title]));

  return {
    nodes: graphData.nodes.map((node) => {
      const listTitle = titleByListId.get(node.listId);
      if (!listTitle || listTitle === node.label) return { ...node };

      return {
        ...node,
        label: listTitle,
      };
    }),
    edges: graphData.edges.map((edge) => ({ ...edge })),
    notes: graphData.notes.map((note) => ({ ...note })),
  };
}

export const renameNode = renameNodeLabel;
export const updateNodeLabels = renameNodeLabel;
export const syncNodeLabels = renameNodeLabel;

export function syncGraphWithLists(
  graphData: StateTransitionGraph,
  activeLists: StateTransitionListLike[],
): StateTransitionGraphSyncResult {
  const stripped = stripDeletedNodes(graphData, activeLists);
  const synced = renameNodeLabel(stripped, activeLists);
  const changed = JSON.stringify(graphData) !== JSON.stringify(synced);

  return { graph: synced, changed };
}
