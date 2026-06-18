import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import { selectFeatureFlagsStatus } from '~/slices/featureFlagsSlice';
import {
  boardSliceActions,
  selectBoard,
  selectListOrder,
  selectLists,
} from '~/extensions/Board/slices/boardSlice';
import type { List } from '~/extensions/List/api';
import { deleteList } from '~/extensions/List/api';
import { apiClient } from '~/common/api/client';
import { useCopyStateTransitionsMutation, useCreateBoardListMutation } from '../../api';
import GraphEditorHeader from './GraphEditorHeader';
import GraphCanvas from './GraphCanvas';
import AddColumnModal from './AddColumnModal';
import NodeDeleteConfirmationModal from './NodeDeleteConfirmationModal';
import CopyTransitionsModal from '../CopyTransitionsModal';
import { useGraphEditor } from './useGraphEditor';
import { useStateTransitionsSync } from './useStateTransitionsSync';
import translations from '../../translations/en.json';
import { stateTransitionsEditorPath } from '~/common/routing/shortUrls';

interface Props {
  boardId: string;
  boardTitle: string;
  open: boolean;
  onClose: () => void;
}

interface PendingColumnDeletion {
  nodeIds: string[];
  edgeIds: string[];
  listNodeIds: string[];
  listTitles: string[];
}

export function buildPendingColumnDeletionSelection({
  selectedNodes,
  selectedEdges,
}: {
  selectedNodes: Array<{ id: string; type?: string; data: { label?: unknown } }>;
  selectedEdges: Array<{ id: string }>;
}): PendingColumnDeletion | null {
  if (selectedNodes.length === 0 && selectedEdges.length === 0) return null;
  const listNodes = selectedNodes.filter((node) => node.type === 'columnNode');
  if (listNodes.length === 0) return null;

  return {
    nodeIds: selectedNodes.map((node) => node.id),
    edgeIds: selectedEdges.map((edge) => edge.id),
    listNodeIds: listNodes.map((node) => node.id),
    listTitles: listNodes.map((node) =>
      typeof node.data.label === 'string' ? node.data.label : node.id
    ),
  };
}

const TOGGLE_PERSIST_DEBOUNCE_MS = 300;

interface EditorToast {
  id: string;
  message: string;
  variant: 'info' | 'success' | 'error';
  href?: string;
  linkLabel?: string;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null) return fallback;
  const maybeError = error as { data?: { data?: { message?: string } }; message?: string };
  return maybeError.data?.data?.message ?? maybeError.message ?? fallback;
}

const GraphEditor = ({ boardId, boardTitle, open, onClose }: Props) => {
  const dispatch = useAppDispatch();
  const featureFlagsStatus = useAppSelector(selectFeatureFlagsStatus);
  const board = useAppSelector(selectBoard);
  const listOrder = useAppSelector(selectListOrder);
  const listsById = useAppSelector(selectLists);
  const currentWorkspaceId = useMemo(() => {
    const boardWithWorkspace = board as { workspaceId?: string; workspace_id?: string } | null;
    return boardWithWorkspace?.workspaceId ?? boardWithWorkspace?.workspace_id ?? null;
  }, [board]);
  const lists = useMemo<List[]>(
    () =>
      listOrder.map((listId) => listsById[listId]).filter((list): list is List => Boolean(list)),
    [listOrder, listsById]
  );

  const {
    isFeatureEnabled,
    transitions,
    isLoading,
    isError,
    errorMessage,
    isSaving: isMutationSaving,
    activeEditorCount,
    remoteUpdate,
    clearRemoteUpdate,
    consumeRecentLocalNodeIds,
    persistTransitions,
  } = useStateTransitionsSync({ boardId, active: open });

  const [createBoardList, createBoardListStatus] = useCreateBoardListMutation();
  const [copyStateTransitions, copyStateTransitionsStatus] = useCopyStateTransitionsMutation();
  const [enabled, setEnabled] = useState(false);
  const [toggleSaving, setToggleSaving] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<
    'add-column' | 'delete-column' | 'copy-transitions' | null
  >(null);
  const [addColumnError, setAddColumnError] = useState<string | null>(null);
  const [deleteColumnError, setDeleteColumnError] = useState<string | null>(null);
  const [copyTransitionsError, setCopyTransitionsError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<EditorToast[]>([]);
  const [pendingColumnPosition, setPendingColumnPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [pendingColumnDeletion, setPendingColumnDeletion] = useState<PendingColumnDeletion | null>(
    null
  );
  const [deleteColumnBusy, setDeleteColumnBusy] = useState(false);

  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const toggleTimeoutRef = useRef<number | null>(null);

  const addToast = useCallback((toast: Omit<EditorToast, 'id'>) => {
    const id = globalThis.crypto.randomUUID();
    setToasts((current) => [...current, { ...toast, id }]);
    globalThis.window.setTimeout(
      () => {
        setToasts((current) => current.filter((entry) => entry.id !== id));
      },
      toast.variant === 'error' ? 6000 : 4000
    );
  }, []);

  useEffect(() => {
    setEnabled(transitions?.enabled ?? false);
  }, [transitions?.enabled]);

  const {
    nodes,
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
    setNodeData,
    selectedColumnNode,
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
    isSaving: isDragSaving,
    saveError,
    editable,
  } = useGraphEditor({
    lists,
    initialGraph: transitions?.graph ?? null,
    enabled,
    consumeRecentLocalNodeIds,
    persistTransitions,
  });

  useEffect(() => {
    if (!remoteUpdate) return;
    applyRemoteGraph(remoteUpdate.graph);
    setEnabled(remoteUpdate.enabled);
    clearRemoteUpdate();
  }, [applyRemoteGraph, clearRemoteUpdate, remoteUpdate]);

  const attemptClose = useCallback(() => {
    const hasPendingSave = toggleSaving || isDragSaving || isMutationSaving || isDirty;
    if (!hasPendingSave) {
      onClose();
      return;
    }

    const shouldClose = globalThis.window.confirm(translations['StateTransitions.unsavedConfirm']);
    if (shouldClose) {
      onClose();
    }
  }, [isDirty, isDragSaving, isMutationSaving, onClose, toggleSaving]);

  useEffect(() => {
    if (open && featureFlagsStatus === 'ready' && !isFeatureEnabled) {
      onClose();
    }
  }, [featureFlagsStatus, isFeatureEnabled, onClose, open]);

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && activeModal === null) {
        event.preventDefault();
        attemptClose();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
        )
      );

      if (focusableElements.length === 0) return;
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [activeModal, attemptClose, open]);

  const handleToggle = useCallback(
    (next: boolean) => {
      setEnabled(next);
      setToggleError(null);
      setToggleSaving(true);

      if (toggleTimeoutRef.current !== null) {
        window.clearTimeout(toggleTimeoutRef.current);
      }

      toggleTimeoutRef.current = window.setTimeout(() => {
        void persistTransitions({ enabled: next, graph: currentGraph })
          .catch((error: unknown) => {
            setToggleError(
              getErrorMessage(error, translations['StateTransitions.toggleSaveFailed'])
            );
          })
          .finally(() => {
            setToggleSaving(false);
          });
      }, TOGGLE_PERSIST_DEBOUNCE_MS);
    },
    [currentGraph, persistTransitions]
  );

  useEffect(
    () => () => {
      if (toggleTimeoutRef.current !== null) {
        window.clearTimeout(toggleTimeoutRef.current);
      }
    },
    []
  );

  const openAddColumnModal = useCallback((x: number, y: number) => {
    setPendingColumnPosition({ x, y });
    setAddColumnError(null);
    setActiveModal('add-column');
  }, []);

  const handleCreateColumn = useCallback(
    async (title: string) => {
      if (!pendingColumnPosition) return;
      setAddColumnError(null);
      try {
        const created = await createBoardList({ boardId, title }).unwrap();
        dispatch(boardSliceActions.addList({ list: created }));
        addColumnNode(
          { id: created.id, title: created.title },
          pendingColumnPosition.x,
          pendingColumnPosition.y
        );
        setActiveModal(null);
        setPendingColumnPosition(null);
      } catch (error: unknown) {
        setAddColumnError(getErrorMessage(error, translations['StateTransitions.addColumnFailed']));
      }
    },
    [addColumnNode, boardId, createBoardList, dispatch, pendingColumnPosition]
  );

  const requestDeleteSelection = useCallback(() => {
    const pendingDeletion = buildPendingColumnDeletionSelection({ selectedNodes, selectedEdges });
    if (!pendingDeletion) {
      if (selectedNodes.length === 0 && selectedEdges.length === 0) return;
      deleteSelectedElements();
      return;
    }

    setDeleteColumnError(null);
    setPendingColumnDeletion(pendingDeletion);
    setActiveModal('delete-column');
  }, [deleteSelectedElements, selectedEdges, selectedNodes]);

  const confirmDeleteColumns = useCallback(async () => {
    if (!pendingColumnDeletion) return;
    setDeleteColumnError(null);
    setDeleteColumnBusy(true);
    try {
      await Promise.all(
        pendingColumnDeletion.listNodeIds.map(async (listId) => {
          await deleteList({ api: apiClient, listId, confirm: true });
        })
      );
      deleteElementsByIds({
        nodeIds: pendingColumnDeletion.nodeIds,
        edgeIds: pendingColumnDeletion.edgeIds,
      });
      setActiveModal(null);
      setPendingColumnDeletion(null);
    } catch (error: unknown) {
      setDeleteColumnError(
        getErrorMessage(error, translations['StateTransitions.deleteColumnFailed'])
      );
    } finally {
      setDeleteColumnBusy(false);
    }
  }, [deleteElementsByIds, pendingColumnDeletion]);

  if (!open || !isFeatureEnabled) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label={translations['StateTransitions.closeBackdropAriaLabel']}
        className="absolute inset-0 bg-black/70"
        onClick={attemptClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="state-transitions-editor-title"
        className="absolute inset-0 m-4 flex flex-col overflow-hidden rounded-xl border border-border bg-bg-base shadow-2xl"
      >
        <GraphEditorHeader
          boardTitle={boardTitle}
          enabled={enabled}
          activeEditorCount={activeEditorCount}
          onToggle={handleToggle}
          toggleLoading={toggleSaving}
          onCopyToBoard={() => {
            setCopyTransitionsError(null);
            setActiveModal('copy-transitions');
          }}
          copyBusy={copyStateTransitionsStatus.isLoading}
          onClose={attemptClose}
        />

        {(saveError || toggleError) && (
          <div className="mx-5 mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {saveError ?? toggleError}
          </div>
        )}

        {isError && (
          <div className="mx-5 mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {errorMessage}
          </div>
        )}

        <div className="min-h-0 flex-1 p-5">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted">{translations['StateTransitions.loading']}</p>
            </div>
          ) : (
            <ReactFlowProvider>
              <GraphCanvas
                nodes={nodes}
                edges={edges}
                defaultAction={defaultAction}
                onSetDefaultAction={setDefaultAction}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onConnectStart={onConnectStart}
                onConnectEnd={onConnectEnd}
                onSelectionChange={onSelectionChange}
                onNodeDragStop={onNodeDragStop}
                onSelectEdge={selectEdge}
                onUpdateEdgeAction={(edgeId, action) => {
                  updateEdge(edgeId, { action });
                }}
                onUpdateEdgeDirection={(edgeId, direction) => {
                  updateEdge(edgeId, { direction });
                }}
                onUpdateEdgeStyle={(edgeId, style) => {
                  updateEdge(edgeId, { style });
                }}
                onPreviewEdgeOffset={(edgeId, connectorOffsetX, connectorOffsetY) => {
                  previewEdgeOffset(edgeId, connectorOffsetX, connectorOffsetY);
                }}
                onCommitEdgeOffset={(edgeId, connectorOffsetX, connectorOffsetY) => {
                  commitEdgeOffset(edgeId, connectorOffsetX, connectorOffsetY);
                }}
                onPreviewEdgeWaypoints={(edgeId, waypoints) => {
                  previewEdgeWaypoints(edgeId, waypoints);
                }}
                onCommitEdgeWaypoints={(edgeId, waypoints) => {
                  commitEdgeWaypoints(edgeId, waypoints);
                }}
                onDeleteEdge={(edgeId) => {
                  deleteElementsByIds({ edgeIds: [edgeId] });
                }}
                onRequestAddColumn={openAddColumnModal}
                onAddNote={addStickyNoteAt}
                onDeleteSelected={requestDeleteSelection}
                onUndo={undo}
                onSelectAll={selectAllElements}
                onEscape={clearSelection}
                selectedEdge={selectedEdge}
                selectedColumnNode={selectedColumnNode}
                onColumnPhaseChange={(nodeId, phases, config) => {
                  setNodeData(nodeId, { workflowPhases: phases, phaseConfig: config });
                }}
                editable={editable && !isError && activeModal === null}
              />
            </ReactFlowProvider>
          )}
        </div>

        <button
          ref={closeButtonRef}
          className="sr-only"
          onClick={attemptClose}
          aria-label={translations['StateTransitions.closeButton']}
        />
      </div>

      <AddColumnModal
        open={activeModal === 'add-column'}
        busy={createBoardListStatus.isLoading}
        error={addColumnError}
        onCancel={() => {
          if (createBoardListStatus.isLoading) return;
          setActiveModal(null);
          setPendingColumnPosition(null);
        }}
        onCreate={handleCreateColumn}
      />

      <NodeDeleteConfirmationModal
        open={activeModal === 'delete-column' && pendingColumnDeletion !== null}
        busy={deleteColumnBusy}
        listTitles={pendingColumnDeletion?.listTitles ?? []}
        error={deleteColumnError}
        onCancel={() => {
          if (deleteColumnBusy) return;
          setActiveModal(null);
          setPendingColumnDeletion(null);
        }}
        onConfirm={confirmDeleteColumns}
      />

      <CopyTransitionsModal
        open={activeModal === 'copy-transitions'}
        sourceBoardId={boardId}
        currentWorkspaceId={currentWorkspaceId}
        busy={copyStateTransitionsStatus.isLoading}
        error={copyTransitionsError}
        onCancel={() => {
          if (copyStateTransitionsStatus.isLoading) return;
          setActiveModal(null);
          setCopyTransitionsError(null);
        }}
        onConfirm={async ({ targetBoard, copyEnabled }) => {
          setCopyTransitionsError(null);
          try {
            const response = await copyStateTransitions({
              boardId,
              targetBoardId: targetBoard.id,
              copyEnabled,
            }).unwrap();
            const targetPath = stateTransitionsEditorPath({
              id: targetBoard.id,
              short_id: targetBoard.short_id ?? null,
              title: targetBoard.title,
            });
            if (response.metadata.skippedNodes > 0) {
              addToast({
                variant: 'info',
                message: translations['StateTransitions.copyPartialToast'].replace(
                  '{count}',
                  String(response.metadata.skippedNodes)
                ),
                href: targetPath,
                linkLabel: translations['StateTransitions.copyToastOpenGraphEditor'],
              });
            } else {
              addToast({
                variant: 'success',
                message: translations['StateTransitions.copySuccessToast'].replace(
                  '{boardName}',
                  targetBoard.title
                ),
                href: targetPath,
                linkLabel: translations['StateTransitions.copyToastOpenGraphEditor'],
              });
            }
            setActiveModal(null);
          } catch (error: unknown) {
            setCopyTransitionsError(
              getErrorMessage(error, translations['StateTransitions.copyModalCopyFailed'])
            );
          }
        }}
      />

      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[90] flex w-96 flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`rounded-lg border px-4 py-3 text-sm shadow-2xl ${
                toast.variant === 'error'
                  ? 'border-red-500/40 bg-red-500/10 text-red-200'
                  : toast.variant === 'success'
                    ? 'border-green-500/40 bg-green-500/10 text-green-200'
                    : 'border-border bg-bg-surface text-base'
              }`}
            >
              <p>{toast.message}</p>
              {toast.href && toast.linkLabel && (
                <a
                  className="mt-1 inline-flex text-xs font-medium text-primary hover:underline"
                  href={toast.href}
                >
                  {toast.linkLabel}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GraphEditor;
