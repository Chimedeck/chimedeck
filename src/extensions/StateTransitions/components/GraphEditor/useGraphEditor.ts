import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MarkerType,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type Node,
  type OnConnect,
  type OnConnectEnd,
  type OnConnectStart,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react';
import type { List } from '~/extensions/List/api';
import {
  type StateTransitionAction,
  type StateTransitionDirection,
  type StateTransitionEdge,
  type StateTransitionGraph,
  type StateTransitionNode,
  type StateTransitionNote,
  type StateTransitionStyle,
  type StateTransitionWaypoint,
} from '../../api';
import { DEFAULT_ACTION_TYPE_ID, getActionTypeConfig } from '../../config/actionTypes';
import { applyRemoteGraphMerge } from './useStateTransitionsSync';

const DRAG_SAVE_DEBOUNCE_MS = 450;
const INVALID_CONNECTION_FEEDBACK_MS = 280;
export const UNDO_STACK_LIMIT = 20;

type GraphEditorNodeType = 'columnNode' | 'stickyNoteNode';

interface StickyNoteNodeCallbacks {
  onStartNoteEdit?: (nodeId: string) => void;
  onFinishNoteEdit?: (nodeId: string) => void;
  onNoteContentChange?: (nodeId: string, nextContent: string) => void;
  onDeleteNode?: (nodeId: string) => void;
}

export interface GraphEditorNodeData extends Record<string, unknown>, StickyNoteNodeCallbacks {
  label?: string;
  listId?: string;
  noteId?: string;
  noteContent?: string;
  isEditing?: boolean;
}

export type GraphEditorNode = Node<GraphEditorNodeData, GraphEditorNodeType>;

export interface GraphEditorEdgeData extends Record<string, unknown> {
  action: StateTransitionAction;
  direction: StateTransitionDirection;
  style: StateTransitionStyle;
  connectorOffsetX: number;
  connectorOffsetY: number;
  waypoints: StateTransitionWaypoint[];
  onInspect?: (edgeId: string) => void;
  onDelete?: (edgeId: string) => void;
}

export type GraphEditorEdge = Edge<GraphEditorEdgeData, 'transitionEdge'> & { data: GraphEditorEdgeData };

interface PersistInput {
  enabled: boolean;
  graph: StateTransitionGraph;
}

interface Args {
  lists: List[];
  initialGraph: StateTransitionGraph | null;
  enabled: boolean;
  persistTransitions: (input: PersistInput) => Promise<void>;
  consumeRecentLocalNodeIds?: () => Set<string>;
}

export interface HistorySnapshot {
  nodes: GraphEditorNode[];
  edges: GraphEditorEdge[];
  selectedEdgeId: string | null;
}

interface DeletionInput {
  nodeIds?: string[];
  edgeIds?: string[];
}

export function createStickyNoteGraphNode({
  id,
  x,
  y,
}: {
  id: string;
  x: number;
  y: number;
}): GraphEditorNode {
  return {
    id,
    type: 'stickyNoteNode',
    position: { x, y },
    data: {
      noteId: id,
      noteContent: '',
      isEditing: true,
    },
  };
}

export function createColumnGraphNode({
  id,
  title,
  x,
  y,
}: {
  id: string;
  title: string;
  x: number;
  y: number;
}): GraphEditorNode {
  return {
    id,
    type: 'columnNode',
    position: { x, y },
    data: {
      label: title,
      listId: id,
    },
  };
}

export function pushUndoSnapshotWithLimit(
  history: HistorySnapshot[],
  snapshot: HistorySnapshot,
  limit = UNDO_STACK_LIMIT,
): HistorySnapshot[] {
  return [...history, snapshot].slice(Math.max(0, history.length + 1 - limit));
}

const createEmptyGraph = (): StateTransitionGraph => ({
  nodes: [],
  edges: [],
  notes: [],
});

const sortLists = (lists: List[]): List[] =>
  [...lists]
    .filter((list) => !list.archived)
    .sort((a, b) => (a.position < b.position ? -1 : 1));

const isStickyNoteNode = (node: GraphEditorNode): boolean => node.type === 'stickyNoteNode';
const isColumnNode = (node: GraphEditorNode): boolean => node.type === 'columnNode';

const toReactFlowNodes = (lists: List[], graph: StateTransitionGraph | null): GraphEditorNode[] => {
  const sortedLists = sortLists(lists);
  const persistedByListId = new Map((graph?.nodes ?? []).map((node) => [node.listId, node]));
  const noteNodes = (graph?.notes ?? []).map<GraphEditorNode>((note) => ({
    id: note.id,
    type: 'stickyNoteNode',
    position: {
      x: note.positionX,
      y: note.positionY,
    },
    data: {
      noteId: note.id,
      noteContent: note.content,
      isEditing: false,
    },
  }));

  return [
    ...sortedLists.map((list, index) => {
      const persisted = persistedByListId.get(list.id);
      return {
        id: list.id,
        type: 'columnNode' as const,
        position: {
          x: persisted?.positionX ?? index * 280 + 40,
          y: persisted?.positionY ?? 200,
        },
        data: {
          label: list.title,
          listId: list.id,
        },
      };
    }),
    ...noteNodes,
  ];
};

const toGraphNodes = (nodes: GraphEditorNode[]): StateTransitionNode[] =>
  nodes
    .filter((node) => isColumnNode(node))
    .map((node) => ({
      id: node.id,
      listId: node.data.listId ?? node.id,
      label: node.data.label ?? '',
      positionX: Math.round(node.position.x),
      positionY: Math.round(node.position.y),
    }));

const toGraphNotes = (nodes: GraphEditorNode[]): StateTransitionNote[] =>
  nodes
    .filter((node) => isStickyNoteNode(node))
    .map((node) => ({
      id: node.id,
      content: typeof node.data.noteContent === 'string' ? node.data.noteContent : '',
      positionX: Math.round(node.position.x),
      positionY: Math.round(node.position.y),
    }));

type HandlePair = {
  sourceHandle: string;
  targetHandle: string;
};

const LEGACY_HANDLE_ID_MAP: Record<string, string> = {
  'top-source': 'top-left-source',
  'top-target': 'top-right-target',
  'right-source': 'right-top-source',
  'right-target': 'right-bottom-target',
  'bottom-source': 'bottom-left-source',
  'bottom-target': 'bottom-right-target',
  'left-source': 'left-top-source',
  'left-target': 'left-bottom-target',
  'top-left': 'top-left-source',
  'top-right': 'top-right-source',
  'right-top': 'right-top-source',
  'right-bottom': 'right-bottom-source',
  'bottom-left': 'bottom-left-source',
  'bottom-right': 'bottom-right-source',
  'left-top': 'left-top-source',
  'left-bottom': 'left-bottom-source',
};

const normalizeHandleId = (handleId: string | null | undefined): string | undefined => {
  if (!handleId) return undefined;
  return LEGACY_HANDLE_ID_MAP[handleId] ?? handleId;
};

const canonicalizeHandleRole = (
  handleId: string | undefined,
  role: 'source' | 'target',
): string | undefined => {
  if (!handleId) return undefined;
  const normalized = normalizeHandleId(handleId);
  if (!normalized) return undefined;
  if (!normalized.endsWith('-source') && !normalized.endsWith('-target')) {
    return normalized;
  }
  return normalized.replace(/-(source|target)$/, `-${role}`);
};

const inferHandlesForEdge = ({
  sourceNode,
  targetNode,
}: {
  sourceNode?: { positionX: number; positionY: number };
  targetNode?: { positionX: number; positionY: number };
}): HandlePair | null => {
  if (!sourceNode || !targetNode) return null;

  const dx = targetNode.positionX - sourceNode.positionX;
  const dy = targetNode.positionY - sourceNode.positionY;
  const horizontal = Math.abs(dx) >= Math.abs(dy);

  if (horizontal) {
    return dx >= 0
      ? { sourceHandle: 'right-top-source', targetHandle: 'left-top-target' }
      : { sourceHandle: 'left-top-source', targetHandle: 'right-top-target' };
  }

  return dy >= 0
    ? { sourceHandle: 'bottom-left-source', targetHandle: 'top-left-target' }
    : { sourceHandle: 'top-left-source', targetHandle: 'bottom-left-target' };
};

const toReactFlowEdges = (graph: StateTransitionGraph | null): GraphEditorEdge[] => {
  const nodeById = new Map((graph?.nodes ?? []).map((node) => [node.id, node]));

  return (graph?.edges ?? []).map((edge) => {
    const actionType = getActionTypeConfig(edge.action);
    const inferredHandles = inferHandlesForEdge({
      sourceNode: nodeById.get(edge.fromNodeId),
      targetNode: nodeById.get(edge.toNodeId),
    });
    let resolvedHandles: Partial<GraphEditorEdge> = {};
    if (typeof edge.sourceHandle === 'string' && typeof edge.targetHandle === 'string') {
      resolvedHandles = {
        sourceHandle: normalizeHandleId(edge.sourceHandle),
        targetHandle: normalizeHandleId(edge.targetHandle),
      };
    } else if (inferredHandles) {
      resolvedHandles = {
        sourceHandle: inferredHandles.sourceHandle,
        targetHandle: inferredHandles.targetHandle,
      };
    }

    return {
      id: edge.id,
      type: 'transitionEdge',
      source: edge.fromNodeId,
      target: edge.toNodeId,
      ...resolvedHandles,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: actionType.colour,
      },
      data: {
        action: edge.action,
        direction: edge.direction,
        style: edge.style,
        connectorOffsetX: edge.connectorOffsetX ?? 0,
        connectorOffsetY: edge.connectorOffsetY ?? 0,
        waypoints: edge.waypoints ?? [],
      },
      ...(edge.direction === 'two_way'
        ? {
            markerStart: {
              type: MarkerType.ArrowClosed,
              color: actionType.colour,
            },
          }
        : {}),
    };
  });
};

const toGraphEdges = (edges: GraphEditorEdge[]): StateTransitionEdge[] =>
  edges.map((edge) => ({
    id: edge.id,
    fromNodeId: edge.source,
    toNodeId: edge.target,
    ...(typeof edge.sourceHandle === 'string' ? { sourceHandle: edge.sourceHandle } : {}),
    ...(typeof edge.targetHandle === 'string' ? { targetHandle: edge.targetHandle } : {}),
    ...(typeof edge.data.connectorOffsetX === 'number' && edge.data.connectorOffsetX !== 0
      ? { connectorOffsetX: edge.data.connectorOffsetX }
      : {}),
    ...(typeof edge.data.connectorOffsetY === 'number' && edge.data.connectorOffsetY !== 0
      ? { connectorOffsetY: edge.data.connectorOffsetY }
      : {}),
    ...(edge.data.waypoints.length > 0
      ? {
          waypoints: edge.data.waypoints.map((waypoint) => ({
            x: waypoint.x,
            y: waypoint.y,
          })),
        }
      : {}),
    action: edge.data.action,
    direction: edge.data.direction,
    style: edge.data.style,
  }));

export function resolveRemoteMerge({
  localGraph,
  remoteGraph,
  recentLocalNodeIds,
}: {
  localGraph: StateTransitionGraph;
  remoteGraph: StateTransitionGraph;
  recentLocalNodeIds: Set<string>;
}): {
  mergedGraph: StateTransitionGraph;
  shouldResetUndoHistory: true;
} {
  return {
    mergedGraph: applyRemoteGraphMerge({
      localGraph,
      remoteGraph,
      recentLocalNodeIds,
    }),
    shouldResetUndoHistory: true,
  };
}

function connectionAlreadyExists(
  edges: GraphEditorEdge[],
  fromNodeId: string,
  toNodeId: string,
): boolean {
  return edges.some((edge) => {
    if (edge.data.direction === 'two_way') {
      return (
        (edge.source === fromNodeId && edge.target === toNodeId)
        || (edge.source === toNodeId && edge.target === fromNodeId)
      );
    }
    return edge.source === fromNodeId && edge.target === toNodeId;
  });
}

export const useGraphEditor = ({
  lists,
  initialGraph,
  enabled,
  persistTransitions,
  consumeRecentLocalNodeIds,
}: Args) => {
  const [nodes, setNodes] = useState<GraphEditorNode[]>(() => toReactFlowNodes(lists, initialGraph));
  const [edges, setEdges] = useState<GraphEditorEdge[]>(() => toReactFlowEdges(initialGraph));
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [rejectedNodeId, setRejectedNodeId] = useState<string | null>(null);
  const [defaultAction, setDefaultAction] = useState<StateTransitionAction>(DEFAULT_ACTION_TYPE_ID);

  const graphRef = useRef<StateTransitionGraph>(initialGraph ?? createEmptyGraph());
  const nodesRef = useRef<GraphEditorNode[]>(nodes);
  const edgesRef = useRef<GraphEditorEdge[]>(edges);
  const saveTimeoutRef = useRef<number | null>(null);
  const rejectTimeoutRef = useRef<number | null>(null);
  const connectStartRef = useRef<{ nodeId: string | null; handleId: string | null } | null>(null);
  const isDirtyRef = useRef(false);
  const isApplyingUndoRef = useRef(false);
  const historyRef = useRef<HistorySnapshot[]>([]);

  const buildGraph = useCallback((nodesToSerialize: GraphEditorNode[], edgesToSerialize: GraphEditorEdge[]): StateTransitionGraph => ({
    nodes: toGraphNodes(nodesToSerialize),
    edges: toGraphEdges(edgesToSerialize),
    notes: toGraphNotes(nodesToSerialize),
  }), []);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    if (isDirtyRef.current) return;
    graphRef.current = initialGraph ?? createEmptyGraph();
    setNodes(toReactFlowNodes(lists, initialGraph));
    setEdges(toReactFlowEdges(initialGraph));
    setSelectedEdgeId(null);
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
    setRejectedNodeId(null);
    setSaveError(null);
    historyRef.current = [];
  }, [initialGraph, lists]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => () => {
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
    }
    if (rejectTimeoutRef.current !== null) {
      window.clearTimeout(rejectTimeoutRef.current);
    }
  }, []);

  const pushHistory = useCallback((snapshotNodes: GraphEditorNode[], snapshotEdges: GraphEditorEdge[]) => {
    if (isApplyingUndoRef.current) return;
    historyRef.current = pushUndoSnapshotWithLimit(
      historyRef.current,
      {
        nodes: snapshotNodes.map((node) => ({ ...node, data: { ...node.data } })),
        edges: snapshotEdges.map((edge) => ({ ...edge, data: { ...edge.data } })),
        selectedEdgeId,
      },
      UNDO_STACK_LIMIT,
    );
  }, [selectedEdgeId]);

  const persistDebounced = useCallback((nodesToPersist: GraphEditorNode[], edgesToPersist: GraphEditorEdge[]) => {
    const graph = buildGraph(nodesToPersist, edgesToPersist);
    graphRef.current = graph;
    setIsDirty(true);
    setSaveError(null);

    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      setIsSaving(true);
      void persistTransitions({ enabled, graph })
        .then(() => {
          setIsDirty(false);
          setSaveError(null);
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Failed to save graph changes';
          setSaveError(message);
        })
        .finally(() => {
          setIsSaving(false);
        });
    }, DRAG_SAVE_DEBOUNCE_MS);
  }, [buildGraph, enabled, persistTransitions]);

  const deleteElementsByIds = useCallback(({ nodeIds = [], edgeIds = [] }: DeletionInput) => {
    if (nodeIds.length === 0 && edgeIds.length === 0) return;
    const nodeIdSet = new Set(nodeIds);
    const edgeIdSet = new Set(edgeIds);

    pushHistory(nodesRef.current, edgesRef.current);

    const nextNodes = nodesRef.current.filter((node) => !nodeIdSet.has(node.id));
    const nextEdges = edgesRef.current.filter((edge) => (
      !edgeIdSet.has(edge.id)
      && !nodeIdSet.has(edge.source)
      && !nodeIdSet.has(edge.target)
    ));

    nodesRef.current = nextNodes;
    edgesRef.current = nextEdges;
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedNodeIds((current) => current.filter((nodeId) => !nodeIdSet.has(nodeId)));
    setSelectedEdgeIds((current) => current.filter((edgeId) => !edgeIdSet.has(edgeId)));
    setSelectedEdgeId((current) => (
      current && nextEdges.some((edge) => edge.id === current) ? current : null
    ));
    persistDebounced(nextNodes, nextEdges);
  }, [persistDebounced, pushHistory]);

  const onNodesChange: OnNodesChange<GraphEditorNode> = useCallback((changes) => {
    const hasRemove = changes.some((change) => change.type === 'remove');
    if (hasRemove) {
      pushHistory(nodesRef.current, edgesRef.current);
    }
    setNodes((current) => {
      const next = applyNodeChanges<GraphEditorNode>(changes, current);
      nodesRef.current = next;
      if (hasRemove) {
        persistDebounced(next, edgesRef.current);
      }
      return next;
    });
  }, [persistDebounced, pushHistory]);

  const onNodeDragStop = useCallback((nodeId: string, x: number, y: number) => {
    pushHistory(nodesRef.current, edgesRef.current);
    setNodes((current) => {
      const next = current.map((node) => (
        node.id === nodeId ? { ...node, position: { x, y } } : node
      ));
      nodesRef.current = next;
      persistDebounced(next, edgesRef.current);
      return next;
    });
  }, [persistDebounced, pushHistory]);

  const triggerRejectedConnectionFeedback = useCallback((nodeId: string) => {
    setRejectedNodeId(nodeId);
    if (rejectTimeoutRef.current !== null) {
      window.clearTimeout(rejectTimeoutRef.current);
    }
    rejectTimeoutRef.current = window.setTimeout(() => {
      setRejectedNodeId(null);
    }, INVALID_CONNECTION_FEEDBACK_MS);
  }, []);

  const onConnect: OnConnect = useCallback((connection: Connection) => {
    const connectStart = connectStartRef.current;
    connectStartRef.current = null;

    const rawSource = connection.source;
    const rawTarget = connection.target;
    const rawSourceHandle = normalizeHandleId(connection.sourceHandle);
    const rawTargetHandle = normalizeHandleId(connection.targetHandle);
    const shouldSwapDirection = Boolean(
      rawSourceHandle?.endsWith('-target') || rawTargetHandle?.endsWith('-source'),
    );

    const source = shouldSwapDirection ? rawTarget : rawSource;
    const target = shouldSwapDirection ? rawSource : rawTarget;
    let sourceHandle = shouldSwapDirection ? rawTargetHandle : rawSourceHandle;
    let targetHandle = shouldSwapDirection ? rawSourceHandle : rawTargetHandle;
    if (!source || !target) return;

    let normalizedSource = source;
    let normalizedTarget = target;
    if (connectStart?.nodeId && connectStart.nodeId === normalizedTarget && connectStart.nodeId !== normalizedSource) {
      normalizedSource = target;
      normalizedTarget = source;
      const previousSourceHandle = sourceHandle;
      sourceHandle = targetHandle;
      targetHandle = previousSourceHandle;
    }

    if (connectStart?.nodeId && connectStart.handleId && connectStart.nodeId === normalizedSource) {
      sourceHandle = normalizeHandleId(connectStart.handleId);
    }

    sourceHandle = canonicalizeHandleRole(sourceHandle, 'source');
    targetHandle = canonicalizeHandleRole(targetHandle, 'target');

    if (normalizedSource === normalizedTarget) {
      triggerRejectedConnectionFeedback(normalizedSource);
      return;
    }

    if (connectionAlreadyExists(edgesRef.current, normalizedSource, normalizedTarget)) {
      return;
    }

    pushHistory(nodesRef.current, edgesRef.current);

    const edgeId = typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `edge-${source}-${target}-${String(Date.now())}`;

    const nextEdge: GraphEditorEdge = {
      id: edgeId,
      type: 'transitionEdge',
      source: normalizedSource,
      target: normalizedTarget,
      ...(sourceHandle ? { sourceHandle } : {}),
      ...(targetHandle ? { targetHandle } : {}),
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: getActionTypeConfig(defaultAction).colour,
      },
      data: {
        action: defaultAction,
        direction: 'one_way',
        style: 'straight',
        connectorOffsetX: 0,
        connectorOffsetY: 0,
        waypoints: [],
      },
    };

    setEdges((current) => {
      const next = [...current, nextEdge];
      edgesRef.current = next;
      persistDebounced(nodesRef.current, next);
      return next;
    });
  }, [defaultAction, persistDebounced, pushHistory, triggerRejectedConnectionFeedback]);

  const onConnectStart: OnConnectStart = useCallback((_event, params) => {
    connectStartRef.current = {
      nodeId: params.nodeId ?? null,
      handleId: params.handleId ?? null,
    };
  }, []);

  const onConnectEnd: OnConnectEnd = useCallback(() => {
    connectStartRef.current = null;
  }, []);

  const onEdgesChange: OnEdgesChange<GraphEditorEdge> = useCallback((changes) => {
    const hasRemove = changes.some((change) => change.type === 'remove');
    if (hasRemove) {
      pushHistory(nodesRef.current, edgesRef.current);
    }
    setEdges((current) => {
      const next = applyEdgeChanges<GraphEditorEdge>(changes, current);
      edgesRef.current = next;
      if (hasRemove) {
        persistDebounced(nodesRef.current, next);
      }
      return next;
    });
  }, [persistDebounced, pushHistory]);

  const updateEdge = useCallback((edgeId: string, patch: Partial<GraphEditorEdgeData>) => {
    pushHistory(nodesRef.current, edgesRef.current);
    setEdges((current) => {
      const next = current.map((edge) => {
        if (edge.id !== edgeId) return edge;
        const nextData: GraphEditorEdgeData = {
          action: edge.data.action,
          direction: edge.data.direction,
          style: edge.data.style,
          connectorOffsetX: edge.data.connectorOffsetX ?? 0,
          connectorOffsetY: edge.data.connectorOffsetY ?? 0,
          waypoints: edge.data.waypoints ?? [],
          ...(edge.data.onInspect ? { onInspect: edge.data.onInspect } : {}),
          ...(edge.data.onDelete ? { onDelete: edge.data.onDelete } : {}),
          ...patch,
        };
        const actionType = getActionTypeConfig(nextData.action);
        const baseEdge = {
          ...edge,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: actionType.colour,
          },
          data: nextData,
        };
        return nextData.direction === 'two_way'
          ? {
              ...baseEdge,
              markerStart: {
                type: MarkerType.ArrowClosed,
                color: actionType.colour,
              },
            }
          : baseEdge;
      });
      edgesRef.current = next;
      persistDebounced(nodesRef.current, next);
      return next;
    });
  }, [persistDebounced, pushHistory]);

  const previewEdgeOffset = useCallback((edgeId: string, connectorOffsetX: number, connectorOffsetY: number) => {
    setEdges((current) => {
      const next = current.map((edge) => {
        if (edge.id !== edgeId) return edge;
        return {
          ...edge,
          data: {
            ...edge.data,
            connectorOffsetX,
            connectorOffsetY,
          },
        };
      });
      edgesRef.current = next;
      return next;
    });
  }, []);

  const commitEdgeOffset = useCallback((edgeId: string, connectorOffsetX: number, connectorOffsetY: number) => {
    pushHistory(nodesRef.current, edgesRef.current);
    setEdges((current) => {
      const next = current.map((edge) => {
        if (edge.id !== edgeId) return edge;
        return {
          ...edge,
          data: {
            ...edge.data,
            connectorOffsetX,
            connectorOffsetY,
          },
        };
      });
      edgesRef.current = next;
      persistDebounced(nodesRef.current, next);
      return next;
    });
  }, [persistDebounced, pushHistory]);

  const previewEdgeWaypoints = useCallback((edgeId: string, waypoints: StateTransitionWaypoint[]) => {
    setEdges((current) => {
      const next = current.map((edge) => {
        if (edge.id !== edgeId) return edge;
        return {
          ...edge,
          data: {
            ...edge.data,
            waypoints,
          },
        };
      });
      edgesRef.current = next;
      return next;
    });
  }, []);

  const commitEdgeWaypoints = useCallback((edgeId: string, waypoints: StateTransitionWaypoint[]) => {
    pushHistory(nodesRef.current, edgesRef.current);
    setEdges((current) => {
      const next = current.map((edge) => {
        if (edge.id !== edgeId) return edge;
        return {
          ...edge,
          data: {
            ...edge.data,
            waypoints,
          },
        };
      });
      edgesRef.current = next;
      persistDebounced(nodesRef.current, next);
      return next;
    });
  }, [persistDebounced, pushHistory]);

  const selectEdge = useCallback((edgeId: string | null) => {
    setSelectedEdgeId(edgeId);
  }, []);

  const onSelectionChange = useCallback((selection: { nodes: GraphEditorNode[]; edges: GraphEditorEdge[] }) => {
    setSelectedNodeIds(selection.nodes.map((node) => node.id));
    setSelectedEdgeIds(selection.edges.map((edge) => edge.id));
  }, []);

  const clearSelection = useCallback(() => {
    setNodes((current) => current.map((node) => ({ ...node, selected: false })));
    setEdges((current) => current.map((edge) => ({ ...edge, selected: false })));
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
    setSelectedEdgeId(null);
  }, []);

  const selectAllElements = useCallback(() => {
    const nextNodes = nodesRef.current.map((node) => ({ ...node, selected: true }));
    const nextEdges = edgesRef.current.map((edge) => ({ ...edge, selected: true }));
    nodesRef.current = nextNodes;
    edgesRef.current = nextEdges;
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedNodeIds(nextNodes.map((node) => node.id));
    setSelectedEdgeIds(nextEdges.map((edge) => edge.id));
  }, []);

  const undo = useCallback(() => {
    const last = historyRef.current.pop();
    if (!last) return;
    isApplyingUndoRef.current = true;
    nodesRef.current = last.nodes;
    edgesRef.current = last.edges;
    setNodes(last.nodes);
    setEdges(last.edges);
    setSelectedEdgeId(last.selectedEdgeId);
    setSelectedNodeIds(last.nodes.filter((node) => node.selected).map((node) => node.id));
    setSelectedEdgeIds(last.edges.filter((edge) => edge.selected).map((edge) => edge.id));
    persistDebounced(last.nodes, last.edges);
    isApplyingUndoRef.current = false;
  }, [persistDebounced]);

  const addStickyNoteAt = useCallback((x: number, y: number) => {
    pushHistory(nodesRef.current, edgesRef.current);
    const noteId = typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `note-${String(Date.now())}`;
    const nextNode = createStickyNoteGraphNode({ id: noteId, x, y });
    const nextNodes = [...nodesRef.current, nextNode];
    nodesRef.current = nextNodes;
    setNodes(nextNodes);
    persistDebounced(nextNodes, edgesRef.current);
  }, [persistDebounced, pushHistory]);

  const addColumnNode = useCallback((list: { id: string; title: string }, x: number, y: number) => {
    pushHistory(nodesRef.current, edgesRef.current);
    const nextNodes = [
      ...nodesRef.current.filter((node) => node.id !== list.id),
      createColumnGraphNode({ id: list.id, title: list.title, x, y }),
    ];
    nodesRef.current = nextNodes;
    setNodes(nextNodes);
    persistDebounced(nextNodes, edgesRef.current);
  }, [persistDebounced, pushHistory]);

  const applyRemoteGraph = useCallback((remoteGraph: StateTransitionGraph) => {
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    const localGraph = buildGraph(nodesRef.current, edgesRef.current);
    const { mergedGraph } = resolveRemoteMerge({
      localGraph,
      remoteGraph,
      recentLocalNodeIds: consumeRecentLocalNodeIds?.() ?? new Set<string>(),
    });

    const nextNodes = toReactFlowNodes(lists, mergedGraph);
    const nextEdges = toReactFlowEdges(mergedGraph);

    graphRef.current = mergedGraph;
    nodesRef.current = nextNodes;
    edgesRef.current = nextEdges;
    setNodes(nextNodes);
    setEdges(nextEdges);
    setIsDirty(false);
    setIsSaving(false);
    setSaveError(null);
    historyRef.current = [];
    setSelectedNodeIds((current) => current.filter((nodeId) => nextNodes.some((node) => node.id === nodeId)));
    setSelectedEdgeIds((current) => current.filter((edgeId) => nextEdges.some((edge) => edge.id === edgeId)));
    setSelectedEdgeId((current) => (
      current && nextEdges.some((edge) => edge.id === current) ? current : null
    ));
  }, [buildGraph, consumeRecentLocalNodeIds, lists]);

  const startNoteEdit = useCallback((nodeId: string) => {
    pushHistory(nodesRef.current, edgesRef.current);
    setNodes((current) => current.map((node) => (
      node.id === nodeId ? { ...node, data: { ...node.data, isEditing: true } } : node
    )));
  }, [pushHistory]);

  const finishNoteEdit = useCallback((nodeId: string) => {
    setNodes((current) => {
      const next = current.map((node) => (
        node.id === nodeId ? { ...node, data: { ...node.data, isEditing: false } } : node
      ));
      nodesRef.current = next;
      persistDebounced(next, edgesRef.current);
      return next;
    });
  }, [persistDebounced]);

  const updateNoteContent = useCallback((nodeId: string, content: string) => {
    setNodes((current) => {
      const next = current.map((node) => (
        node.id === nodeId ? { ...node, data: { ...node.data, noteContent: content } } : node
      ));
      nodesRef.current = next;
      return next;
    });
  }, []);

  const deleteSelectedElements = useCallback(() => {
    deleteElementsByIds({ nodeIds: selectedNodeIds, edgeIds: selectedEdgeIds });
  }, [deleteElementsByIds, selectedEdgeIds, selectedNodeIds]);

  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId],
  );

  const selectedNodes = useMemo(
    () => nodes.filter((node) => selectedNodeIds.includes(node.id)),
    [nodes, selectedNodeIds],
  );

  const selectedEdges = useMemo(
    () => edges.filter((edge) => selectedEdgeIds.includes(edge.id)),
    [edges, selectedEdgeIds],
  );

  const renderedNodes = useMemo(
    () => nodes.map((node) => {
      const withHandlers = isStickyNoteNode(node)
        ? {
            ...node,
            data: {
              ...node.data,
              onStartNoteEdit: startNoteEdit,
              onFinishNoteEdit: finishNoteEdit,
              onNoteContentChange: updateNoteContent,
              onDeleteNode: (nodeId: string) => {
                deleteElementsByIds({ nodeIds: [nodeId] });
              },
            },
          }
        : node;
      if (withHandlers.id === rejectedNodeId) {
        return { ...withHandlers, className: 'animate-state-transition-shake' };
      }
      const { className, ...rest } = withHandlers;
      void className;
      return rest;
    }),
    [deleteElementsByIds, finishNoteEdit, nodes, rejectedNodeId, startNoteEdit, updateNoteContent],
  );

  const currentGraph = useMemo(() => buildGraph(nodes, edges), [buildGraph, edges, nodes]);

  return {
    nodes: renderedNodes,
    edges,
    defaultAction,
    setDefaultAction,
    onNodesChange,
    onNodeDragStop,
    onConnect,
    onConnectStart,
    onConnectEnd,
    onEdgesChange,
    onSelectionChange,
    selectedEdge,
    selectedNodes,
    selectedEdges,
    selectEdge,
    updateEdge,
    previewEdgeOffset,
    commitEdgeOffset,
    previewEdgeWaypoints,
    commitEdgeWaypoints,
    deleteElementsByIds,
    deleteSelectedElements,
    clearSelection,
    selectAllElements,
    undo,
    addStickyNoteAt,
    addColumnNode,
    currentGraph,
    applyRemoteGraph,
    isDirty,
    isSaving,
    saveError,
    editable: saveError === null,
  };
};
