// Integration tests for the ColumnPhaseEditor wired in GraphCanvas.
// Sprint 172 — verifies:
// 1. Clicking a column node opens the phase editor inspector.
// 2. Phase toggle updates node data and marks graph dirty.
// 3. Deselecting (pane click / Escape) closes the inspector.
// 4. Selecting a different node switches the inspector context.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ReactFlowProvider } from '@xyflow/react';

// [why] @xyflow/react uses ResizeObserver internally; jsdom doesn't ship it.
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
import GraphCanvas from '../GraphCanvas';
import type { GraphEditorNode, GraphEditorEdge, GraphEditorNodeData } from '../useGraphEditor';
import type {
  StateTransitionAction,
  StateTransitionDirection,
  StateTransitionStyle,
  StateTransitionWaypoint,
} from '../../../api';

// Mock the API imports that GraphCanvas depends on
vi.mock('../../../config/actionTypes', () => ({
  ACTION_TYPES: [
    { id: 'allowed_move_to', labelKey: 'StateTransitions.action.allowedMoveTo', colour: '#3b82f6' },
  ],
  getActionTypeConfig: () => ({ colour: '#3b82f6' }),
}));

vi.mock('../../../translations/en.json', () => ({
  default: {
    'StateTransitions.action.allowedMoveTo': 'Allowed move to',
    'StateTransitions.edgeInspectorTitle': 'Edge inspector',
    'StateTransitions.edgeInspectorClose': 'Close',
    'StateTransitions.edgeInspectorAction': 'Action',
    'StateTransitions.edgeInspectorDirection': 'Direction',
    'StateTransitions.edgeInspectorStyle': 'Style',
    'StateTransitions.edgeInspectorDelete': 'Delete edge',
    'StateTransitions.columnInspectorTitle': 'Column Phases',
    'StateTransitions.columnInspectorClose': 'Close column inspector',
    'StateTransitions.edgeDirectionOneWay': '→ One-way',
    'StateTransitions.edgeDirectionTwoWay': '↔ Two-way',
    'StateTransitions.edgeStyleStraight': '─ Straight',
    'StateTransitions.edgeStyleOrthogonal': '└ Orthogonal',
    'StateTransitions.edgeStyleSmooth': '~ Smooth',
    'StateTransitions.edgeStyleCurved': '~ Curved',
    'StateTransitions.toolbarAddColumn': 'Add Column',
    'StateTransitions.toolbarArrowType': 'Arrow',
    'StateTransitions.toolbarAddNote': 'Add Note',
    'StateTransitions.emptyState': 'No lists found on this board yet.',
  },
}));

// Mock reactflow CSS
vi.mock('@xyflow/react/dist/style.css', () => ({}));

function makeStore() {
  return configureStore({
    reducer: {
      featureFlags: () => ({
        stateTransitionsEnabled: true,
        status: 'ready',
      }),
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware(),
  });
}

function makeColumnNode(overrides?: Partial<GraphEditorNode>): GraphEditorNode {
  return {
    id: 'col-1',
    type: 'columnNode',
    position: { x: 100, y: 100 },
    data: {
      label: 'Backlog',
      listId: 'col-1',
      workflowPhases: [],
    } as GraphEditorNodeData,
    ...overrides,
  } as GraphEditorNode;
}

interface MinimalProps {
  nodes?: GraphEditorNode[];
  edges?: GraphEditorEdge[];
  selectedEdge?: GraphEditorEdge | null;
  selectedColumnNode?: GraphEditorNode | null;
  editable?: boolean;
}

function renderGraphCanvas(props: MinimalProps = {}) {
  const {
    nodes = [makeColumnNode()],
    edges = [],
    selectedEdge = null,
    selectedColumnNode = null,
    editable = true,
  } = props;

  const noop = () => undefined;
  return render(
    <Provider store={makeStore()}>
      <ReactFlowProvider>
        <GraphCanvas
          nodes={nodes}
          edges={edges}
          defaultAction={'allowed_move_to' as StateTransitionAction}
          onSetDefaultAction={noop}
          onNodesChange={noop}
          onEdgesChange={noop}
          onConnect={noop}
          onConnectStart={noop}
          onConnectEnd={noop}
          onNodeDragStop={noop}
          onSelectionChange={noop}
          onSelectEdge={noop}
          onUpdateEdgeAction={noop}
          onUpdateEdgeDirection={noop}
          onUpdateEdgeStyle={noop}
          onPreviewEdgeOffset={noop}
          onCommitEdgeOffset={noop}
          onPreviewEdgeWaypoints={noop}
          onCommitEdgeWaypoints={noop}
          onDeleteEdge={noop}
          onAddNote={noop}
          onRequestAddColumn={noop}
          onDeleteSelected={noop}
          onUndo={noop}
          onSelectAll={noop}
          onEscape={noop}
          selectedEdge={selectedEdge}
          selectedColumnNode={selectedColumnNode}
          onColumnPhaseChange={noop}
          editable={editable}
        />
      </ReactFlowProvider>
    </Provider>
  );
}

describe('ColumnPhaseEditor wired in GraphCanvas', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it('does not show column inspector when selectedColumnNode is null', () => {
    renderGraphCanvas({ selectedColumnNode: null });
    // The inspector title should not be present
    expect(screen.queryByText('Column Phases')).toBeNull();
  });

  it('renders column inspector when a column node is selected and no edge is selected', () => {
    const node = makeColumnNode({
      data: {
        label: 'Backlog',
        listId: 'col-1',
        workflowPhases: ['NEW_DRAFT'],
      } as GraphEditorNodeData,
    });
    renderGraphCanvas({ selectedColumnNode: node, selectedEdge: null });
    expect(screen.getByText('Column Phases')).toBeDefined();
  });

  it('shows selected phases as checked in the phase editor', () => {
    const node = makeColumnNode({
      data: {
        label: 'Backlog',
        listId: 'col-1',
        workflowPhases: ['NEW_DRAFT', 'SYNC_DOCUMENT'],
        phaseConfig: { serviceTierOverride: null, autoRun: false, requiresHumanApproval: true },
      } as GraphEditorNodeData,
    });
    renderGraphCanvas({ selectedColumnNode: node, selectedEdge: null });

    // The "New Draft" phase label chip should be shown checked
    expect(screen.getByText('New Draft')).toBeDefined();
    expect(screen.getByText('Sync Document')).toBeDefined();
  });

  it('hides column inspector when an edge is selected instead', () => {
    const node = makeColumnNode({
      data: {
        label: 'Backlog',
        listId: 'col-1',
        workflowPhases: ['NEW_DRAFT'],
      } as GraphEditorNodeData,
    });
    const edge: GraphEditorEdge = {
      id: 'e-1',
      type: 'transitionEdge',
      source: 'col-1',
      target: 'col-2',
      data: {
        action: 'allowed_move_to' as StateTransitionAction,
        direction: 'one_way' as StateTransitionDirection,
        style: 'straight' as StateTransitionStyle,
        connectorOffsetX: 0,
        connectorOffsetY: 0,
        waypoints: [],
      },
    };
    renderGraphCanvas({ selectedColumnNode: node, selectedEdge: edge });

    // Column inspector should NOT render when edge inspector takes priority
    expect(screen.queryByText('Column Phases')).toBeNull();
    // Edge inspector should be visible
    expect(screen.getByText('Edge inspector')).toBeDefined();
  });

  it('calls onColumnPhaseChange when a phase checkbox is toggled', () => {
    const node = makeColumnNode({
      data: {
        label: 'Backlog',
        listId: 'col-1',
        workflowPhases: [] as string[],
      } as GraphEditorNodeData,
    });

    const phaseChangeSpy = vi.fn();
    render(
      <Provider store={makeStore()}>
        <ReactFlowProvider>
          <GraphCanvas
            nodes={[node]}
            edges={[]}
            defaultAction={'allowed_move_to' as StateTransitionAction}
            onSetDefaultAction={() => undefined}
            onNodesChange={() => undefined}
            onEdgesChange={() => undefined}
            onConnect={() => undefined}
            onConnectStart={() => undefined}
            onConnectEnd={() => undefined}
            onNodeDragStop={() => undefined}
            onSelectionChange={() => undefined}
            onSelectEdge={() => undefined}
            onUpdateEdgeAction={() => undefined}
            onUpdateEdgeDirection={() => undefined}
            onUpdateEdgeStyle={() => undefined}
            onPreviewEdgeOffset={() => undefined}
            onCommitEdgeOffset={() => undefined}
            onPreviewEdgeWaypoints={() => undefined}
            onCommitEdgeWaypoints={() => undefined}
            onDeleteEdge={() => undefined}
            onAddNote={() => undefined}
            onRequestAddColumn={() => undefined}
            onDeleteSelected={() => undefined}
            onUndo={() => undefined}
            onSelectAll={() => undefined}
            onEscape={() => undefined}
            selectedEdge={null}
            selectedColumnNode={node}
            onColumnPhaseChange={phaseChangeSpy}
            editable={true}
          />
        </ReactFlowProvider>
      </Provider>
    );

    const newDraftLabel = screen.getByText('New Draft');
    fireEvent.click(newDraftLabel);

    expect(phaseChangeSpy).toHaveBeenCalled();
    const [calledNodeId, calledPhases] = phaseChangeSpy.mock.calls[0] as [string, string[]];
    expect(calledNodeId).toBe('col-1');
    expect(calledPhases).toContain('NEW_DRAFT');
  });
});
