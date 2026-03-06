// BoardPage — renders a single board with lists and cards as a kanban view.
// Sprint 18: uses boardSlice (DndContext via BoardCanvas, optimistic card/list drag).
// Sprint 19: ?card=:id URL param opens CardModal.
// Sprint 20: real-time sync via useWebSocket + useBoardSync; ConnectionBadge in header.
import { useEffect, useCallback, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAppSelector } from '~/hooks/useAppSelector';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import {
  fetchBoardDataThunk,
  boardSliceActions,
  selectBoard,
  selectListOrder,
  selectLists,
  selectCardsByList,
  selectCards,
  selectBoardStatus,
} from '../../slices/boardSlice';import BoardHeader from '../../components/BoardHeader';
import BoardCanvas from '../../components/BoardCanvas';
import CardModalContainer from '../../../Card/containers/CardModal';
import BoardSettings from '../BoardSettings/BoardSettings';
import ToastRegion from '~/common/components/ToastRegion';
import type { ToastItem } from '~/common/components/ToastRegion';
import { updateBoard, archiveBoard, deleteBoard } from '../../api';
import { createList, updateList, archiveList, deleteList, reorderLists } from '../../../List/api';
import { createCard } from '../../../Card/api';
import { moveCard } from '../../api/card';
import { useWebSocket } from '../../../Realtime/hooks/useWebSocket';
import { useBoardSync } from '../../../Realtime/hooks/useBoardSync';
import { selectAuthToken } from '../../../Auth/duck/authDuck';
import { apiClient } from '~/common/api/client';
import PluginIframeContainer from '../../../Plugins/iframeHost/PluginIframeContainer';

// Injected by app bootstrap (same pattern as other containers)
declare const __api__: {
  get: <T>(url: string) => Promise<T>;
  post: <T>(url: string, data: unknown) => Promise<T>;
  patch: <T>(url: string, data?: unknown) => Promise<T>;
  delete: <T>(url: string) => Promise<T>;
};

const BoardPage = () => {
  const dispatch = useAppDispatch();
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();

  const board = useAppSelector(selectBoard);
  const listOrder = useAppSelector(selectListOrder);
  const lists = useAppSelector(selectLists);
  const cardsByList = useAppSelector(selectCardsByList);
  const cards = useAppSelector(selectCards);
  const status = useAppSelector(selectBoardStatus);
  const accessToken = useAppSelector(selectAuthToken);

  // Use the shared axios client instead of a globalThis reference
  const api = apiClient;

  // ── Toast notifications ───────────────────────────────────────────────────
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const addToast = useCallback((message: string, variant: ToastItem['variant'] = 'error') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, variant }]);
  }, []);
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Board settings panel ─────────────────────────────────────────────────
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ── Real-time sync (sprint-20) ────────────────────────────────────────────
  const { handleEvent, lastSequence } = useBoardSync({ boardId: boardId ?? '' });
  const { connectionState } = useWebSocket({
    boardId: boardId ?? '',
    token: accessToken ?? '',
    lastSequence,
    onEvent: handleEvent,
    onMutationConflict: () =>
      addToast('A mutation conflicted with a remote change and was discarded.', 'conflict'),
    onQueueOverflow: () => {
      // Full reload on overflow so state is not stale
      if (boardId) dispatch(fetchBoardDataThunk({ boardId }));
    },
  });

  useEffect(() => {
    if (boardId) dispatch(fetchBoardDataThunk({ boardId }));
  }, [dispatch, boardId]);

  // Open card modal via URL param
  const handleCardClick = useCallback(
    (cardId: string) => {
      setSearchParams((p) => {
        const next = new URLSearchParams(p);
        next.set('card', cardId);
        return next;
      });
    },
    [setSearchParams],
  );

  // ── Board title ─────────────────────────────────────────────────────────
  const handleTitleSave = useCallback(async (title: string) => {
      if (!board || !boardId) return;
      dispatch(boardSliceActions.optimisticUpdateBoardTitle({ title }));
      try {
        await updateBoard({ api, boardId, title });
      } catch {
        // Rollback — re-fetch authoritative state
        dispatch(fetchBoardDataThunk({ boardId }));
      }
    },
    [api, board, boardId, dispatch],
  );

  // ── Drag snapshot / rollback ─────────────────────────────────────────────
  const handleDragStart = useCallback(() => {
    dispatch(boardSliceActions.saveDragSnapshot());
  }, [dispatch]);

  const handleDragRollback = useCallback(() => {
    dispatch(boardSliceActions.rollbackDrag());
  }, [dispatch]);

  // ── Card move ────────────────────────────────────────────────────────────
  const handleCardMove = useCallback(
    (args: { cardId: string; fromListId: string; toListId: string; newIndex: number }) => {
      dispatch(boardSliceActions.applyOptimisticCardMove(args));
    },
    [dispatch],
  );

  // ── List reorder ─────────────────────────────────────────────────────────
  const handleListReorder = useCallback(
    (newOrder: string[]) => {
      dispatch(boardSliceActions.applyOptimisticListReorder({ newOrder }));
    },
    [dispatch],
  );

  // ── Drag commit (API call after successful drag) ─────────────────────────
  const handleDragCommit = useCallback(
    async (args: {
      type: 'card' | 'list';
      cardId?: string;
      fromListId?: string;
      toListId?: string;
      afterCardId?: string | null;
      newListOrder?: string[];
    }) => {
      if (!boardId) return;
      if (args.type === 'card' && args.cardId && args.toListId) {
        await moveCard({
          api,
          cardId: args.cardId,
          targetListId: args.toListId,
          afterCardId: args.afterCardId ?? null,
        });
        dispatch(boardSliceActions.clearDragSnapshot());
      } else if (args.type === 'list' && args.newListOrder) {
        await reorderLists({ api, boardId, order: args.newListOrder });
        dispatch(boardSliceActions.clearDragSnapshot());
      }
    },
    [api, boardId, dispatch],
  );

  // ── Inline card creation ─────────────────────────────────────────────────
  const handleAddCard = useCallback(
    async (listId: string, title: string) => {
      const result = await createCard({ api, listId, title });
      dispatch(boardSliceActions.addCard({ card: result.data }));
    },
    [api, dispatch],
  );

  // ── Inline list creation ─────────────────────────────────────────────────
  const handleAddList = useCallback(
    async (title: string) => {
      if (!boardId) return;
      const result = await createList({ api, boardId, title });
      dispatch(boardSliceActions.addList({ list: result.data }));
    },
    [api, boardId, dispatch],
  );

  // ── List rename ──────────────────────────────────────────────────────────
  const handleRenameList = useCallback(
    (listId: string, title: string) => {
      // Optimistic: update local state; fire API in background
      updateList({ api, listId, title }).catch(() => {
        // On failure, re-fetch to restore authoritative state
        if (boardId) dispatch(fetchBoardDataThunk({ boardId }));
      });
    },
    [api, boardId, dispatch],
  );

  // ── List archive / delete ────────────────────────────────────────────────
  const handleArchiveList = useCallback(
    async (listId: string) => {
      try {
        await archiveList({ api, listId });
        if (boardId) dispatch(fetchBoardDataThunk({ boardId }));
      } catch {
        // TODO: surface error to user
      }
    },
    [api, boardId, dispatch],
  );

  const handleDeleteList = useCallback(
    async (listId: string) => {
      if (!confirm('Delete this list? All cards will be removed.')) return;
      try {
        await deleteList({ api, listId });
        if (boardId) dispatch(fetchBoardDataThunk({ boardId }));
      } catch {
        // TODO: surface error to user
      }
    },
    [api, boardId, dispatch],
  );

  // ── Board archive / delete ─────────────────────────────────────────────
  const handleBoardArchive = useCallback(async () => {
    if (!boardId || !board) return;
    try {
      await archiveBoard({ api, boardId });
      dispatch(fetchBoardDataThunk({ boardId }));
    } catch {
      addToast('Failed to archive board.', 'error');
    }
  }, [api, board, boardId, dispatch, addToast]);

  const handleBoardDelete = useCallback(async () => {
    if (!boardId) return;
    if (!confirm('Delete this board? All lists and cards will be permanently removed.')) return;
    try {
      await deleteBoard({ api, boardId });
      navigate('/workspaces');
    } catch {
      addToast('Failed to delete board.', 'error');
    }
  }, [api, boardId, navigate, addToast]);

  // ── Render ───────────────────────────────────────────────────────────────

  if (status === 'loading' && !board) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <p className="text-slate-400">Loading board…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <p className="text-red-400">Failed to load board.</p>
      </div>
    );
  }

  if (!board) return null;

  return (
    <div className="flex flex-col bg-slate-950 text-slate-100 min-h-full">
      <BoardHeader
        board={board}
        connectionState={connectionState}
        onTitleSave={handleTitleSave}
        onArchive={handleBoardArchive}
        onDelete={handleBoardDelete}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      {board.state === 'ARCHIVED' && (
        <div className="mx-4 mt-2 rounded border border-yellow-700 bg-yellow-900/30 px-4 py-2 text-sm text-yellow-400">
          This board is archived and read-only.
        </div>
      )}
      {/* Hidden plugin iframes + bridge provider for card plugin UI injections */}
      <PluginIframeContainer boardId={boardId ?? ''}>
        <BoardCanvas
          boardId={boardId ?? ''}
          boardTitle={board.title}
          listOrder={listOrder}
          lists={lists}
          cardsByList={cardsByList}
          cards={cards}
          onCardMove={handleCardMove}
          onListReorder={handleListReorder}
          onDragStart={handleDragStart}
          onDragCommit={handleDragCommit}
          onDragRollback={handleDragRollback}
          onAddCard={handleAddCard}
          onAddList={handleAddList}
          onRenameList={handleRenameList}
          onArchiveList={handleArchiveList}
          onDeleteList={handleDeleteList}
          onCardClick={handleCardClick}
          isReadOnly={board.state === 'ARCHIVED'}
        />
        {/* Card detail modal — URL-driven (?card=:id) */}
        <CardModalContainer />
        {/* Board settings panel */}
        {settingsOpen && (
          <BoardSettings
            onClose={() => setSettingsOpen(false)}
          />
        )}
        {/* Toast notifications (rollback errors, conflicts) */}
        <ToastRegion toasts={toasts} onDismiss={dismissToast} />
      </PluginIframeContainer>
    </div>
  );
};

export default BoardPage;
