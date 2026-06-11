import { useCallback, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  type EdgeTypes,
  type OnConnect,
  type OnConnectEnd,
  type OnConnectStart,
  type OnEdgesChange,
  type OnNodesChange,
  MiniMap,
  ReactFlow,
  type ReactFlowInstance,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ACTION_TYPES } from '../../config/actionTypes';
import type {
  StateTransitionAction,
  StateTransitionDirection,
  StateTransitionStyle,
  StateTransitionWaypoint,
} from '../../api';
import ColumnNode from './ColumnNode';
import ColumnPhaseEditor from '../ColumnPhaseEditor';
import EdgeInspector from './EdgeInspector';
import GraphEditorToolbar from './GraphEditorToolbar';
import StickyNoteNode from './StickyNoteNode';
import TransitionEdge from './TransitionEdge';
import { useGraphEditorKeyboardShortcuts } from './keyboardShortcuts';
import type { GraphEditorEdge, GraphEditorNode } from './useGraphEditor';
import type { WorkflowPhase, PhaseConfig } from '../../api';
import translations from '../../translations/en.json';

const nodeTypes: NodeTypes = {
  columnNode: ColumnNode,
  stickyNoteNode: StickyNoteNode,
};

const edgeTypes: EdgeTypes = {
  transitionEdge: TransitionEdge,
};

interface Props {
  nodes: GraphEditorNode[];
  edges: GraphEditorEdge[];
  defaultAction: StateTransitionAction;
  onSetDefaultAction: (nextAction: StateTransitionAction) => void;
  onNodesChange: OnNodesChange<GraphEditorNode>;
  onEdgesChange: OnEdgesChange<GraphEditorEdge>;
  onConnect: OnConnect;
  onConnectStart: OnConnectStart;
  onConnectEnd: OnConnectEnd;
  onNodeDragStop: (nodeId: string, x: number, y: number) => void;
  onSelectionChange: (selection: { nodes: GraphEditorNode[]; edges: GraphEditorEdge[] }) => void;
  onSelectEdge: (edgeId: string | null) => void;
  onUpdateEdgeAction: (edgeId: string, nextAction: StateTransitionAction) => void;
  onUpdateEdgeDirection: (edgeId: string, nextDirection: StateTransitionDirection) => void;
  onUpdateEdgeStyle: (edgeId: string, nextStyle: StateTransitionStyle) => void;
  onPreviewEdgeOffset: (edgeId: string, connectorOffsetX: number, connectorOffsetY: number) => void;
  onCommitEdgeOffset: (edgeId: string, connectorOffsetX: number, connectorOffsetY: number) => void;
  onPreviewEdgeWaypoints: (edgeId: string, waypoints: StateTransitionWaypoint[]) => void;
  onCommitEdgeWaypoints: (edgeId: string, waypoints: StateTransitionWaypoint[]) => void;
  onDeleteEdge: (edgeId: string) => void;
  onAddNote: (x: number, y: number) => void;
  onRequestAddColumn: (x: number, y: number) => void;
  onDeleteSelected: () => void;
  onUndo: () => void;
  onSelectAll: () => void;
  onEscape: () => void;
  selectedEdge: GraphEditorEdge | null;
  // Sprint 172 — workflow phase editor for column nodes
  selectedColumnNode: GraphEditorNode | null;
  onColumnPhaseChange: (nodeId: string, phases: WorkflowPhase[], config: PhaseConfig) => void;
  editable: boolean;
}

const GraphCanvas = ({
  nodes,
  edges,
  defaultAction,
  onSetDefaultAction,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onConnectStart,
  onConnectEnd,
  onNodeDragStop,
  onSelectionChange,
  onSelectEdge,
  onUpdateEdgeAction,
  onUpdateEdgeDirection,
  onUpdateEdgeStyle,
  onPreviewEdgeOffset,
  onCommitEdgeOffset,
  onPreviewEdgeWaypoints,
  onCommitEdgeWaypoints,
  onDeleteEdge,
  onAddNote,
  onRequestAddColumn,
  onDeleteSelected,
  onUndo,
  onSelectAll,
  onEscape,
  selectedEdge,
  selectedColumnNode,
  onColumnPhaseChange,
  editable,
}: Props) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [instance, setInstance] = useState<ReactFlowInstance<GraphEditorNode, GraphEditorEdge> | null>(null);

  const getViewportCenter = useCallback(() => {
    if (!instance || !rootRef.current) {
      return { x: 160, y: 160 };
    }
    const rect = rootRef.current.getBoundingClientRect();
    return instance.screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  }, [instance]);

  useGraphEditorKeyboardShortcuts({
    enabled: editable,
    scopeElement: rootRef.current,
    onDelete: onDeleteSelected,
    onUndo,
    onSelectAll,
    onEscape: () => {
      onSelectEdge(null);
      onEscape();
    },
  });

  return (
    <div ref={rootRef} className="relative h-full w-full rounded-lg border border-border bg-bg-base">
      <ReactFlow
        nodes={nodes}
        edges={edges.map((edge) => ({
          ...edge,
          data: {
            ...edge.data,
            onInspect: (edgeId: string) => {
              onSelectEdge(edgeId);
            },
            onDelete: onDeleteEdge,
            onPreviewOffset: (edgeId: string, offsetX: number, offsetY: number) => {
              onPreviewEdgeOffset(edgeId, offsetX, offsetY);
            },
            onCommitOffset: (edgeId: string, offsetX: number, offsetY: number) => {
              onCommitEdgeOffset(edgeId, offsetX, offsetY);
            },
            onPreviewWaypoints: (edgeId: string, waypoints: StateTransitionWaypoint[]) => {
              onPreviewEdgeWaypoints(edgeId, waypoints);
            },
            onCommitWaypoints: (edgeId: string, waypoints: StateTransitionWaypoint[]) => {
              onCommitEdgeWaypoints(edgeId, waypoints);
            },
          },
        }))}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={setInstance}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onSelectionChange={onSelectionChange}
        onNodeDragStop={(_event, node) => {
          onNodeDragStop(node.id, node.position.x, node.position.y);
        }}
        onEdgeClick={(_event, edge) => {
          onSelectEdge(edge.id);
        }}
        onPaneClick={(event) => {
          if ((event.target as HTMLElement | null)?.closest('[data-edge-inspector="true"]')) {
            return;
          }
          if ((event.target as HTMLElement | null)?.closest('[data-column-inspector="true"]')) {
            return;
          }
          onSelectEdge(null);
          onEscape();
        }}
        connectionMode={ConnectionMode.Loose}
        fitView
        minZoom={0.2}
        maxZoom={1.5}
        deleteKeyCode={null}
        nodesDraggable={editable}
        nodesConnectable={editable}
        edgesFocusable={editable}
        elementsSelectable={editable}
        selectNodesOnDrag={false}
        proOptions={{ hideAttribution: true }}
      >
        <MiniMap
          pannable
          zoomable
          position="bottom-right"
          className="!bg-bg-surface !border !border-border"
          nodeColor={() => '#94a3b8'}
        />
        <Controls position="bottom-left" className="!border !border-border !bg-bg-surface" />
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
      </ReactFlow>

      {nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-muted">{translations['StateTransitions.emptyState']}</p>
        </div>
      )}

      <GraphEditorToolbar
        actionTypes={ACTION_TYPES}
        selectedAction={defaultAction}
        disabled={!editable}
        onActionChange={onSetDefaultAction}
        onAddColumn={() => {
          const center = getViewportCenter();
          onRequestAddColumn(center.x, center.y);
        }}
        onAddNote={() => {
          const center = getViewportCenter();
          onAddNote(center.x, center.y);
        }}
      />

      {selectedEdge && (
        <EdgeInspector
          actionTypes={ACTION_TYPES}
          selectedAction={selectedEdge.data.action}
          selectedDirection={selectedEdge.data.direction}
          selectedStyle={selectedEdge.data.style}
          onActionChange={(nextAction) => {
            onUpdateEdgeAction(selectedEdge.id, nextAction);
          }}
          onDirectionChange={(nextDirection) => {
            onUpdateEdgeDirection(selectedEdge.id, nextDirection);
          }}
          onStyleChange={(nextStyle) => {
            onUpdateEdgeStyle(selectedEdge.id, nextStyle);
          }}
          onDelete={() => {
            onDeleteEdge(selectedEdge.id);
          }}
          onClose={() => {
            onSelectEdge(null);
          }}
        />
      )}

      {selectedColumnNode && !selectedEdge && (
        <aside
          data-column-inspector="true"
          className="nodrag nopan pointer-events-auto absolute right-4 top-4 z-20 w-72 rounded-lg border border-border bg-bg-surface p-3 shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-base">
              {translations['StateTransitions.columnInspectorTitle'] ?? 'Column Phases'}
            </h3>
            <button
              type="button"
              aria-label={translations['StateTransitions.columnInspectorClose'] ?? 'Close'}
              className="rounded p-1 text-muted hover:bg-bg-overlay hover:text-base"
              onClick={() => {
                onSelectEdge(null);
                onEscape();
              }}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <ColumnPhaseEditor
            selectedPhases={(selectedColumnNode.data.workflowPhases as WorkflowPhase[] | undefined) ?? []}
            phaseConfig={{
              serviceTierOverride: (selectedColumnNode.data.phaseConfig as PhaseConfig | undefined)?.serviceTierOverride ?? null,
              autoRun: (selectedColumnNode.data.phaseConfig as PhaseConfig | undefined)?.autoRun ?? false,
              requiresHumanApproval: (selectedColumnNode.data.phaseConfig as PhaseConfig | undefined)?.requiresHumanApproval ?? true,
            }}
            onChange={(phases, config) => {
              onColumnPhaseChange(selectedColumnNode.id, phases, config);
            }}
          />
        </aside>
      )}
    </div>
  );
};

export default GraphCanvas;
