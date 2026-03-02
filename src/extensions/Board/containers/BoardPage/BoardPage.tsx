// BoardPage — renders a single board with lists and cards as a kanban view.
// Sprint 18: uses boardSlice (DndContext via BoardCanvas, optimistic card/list drag).
// Sprint 19: ?card=:id URL param opens CardModal.
// Realtime sync (sprint 20) is wired in via useWebSocket + useBoardSync.
import { useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
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
} from '../../slices/boardSlice';
import BoardHeader from '../../components/BoardHeader';
import BoardCanvas from '../../components/BoardCanvas';
import CardModalContainer from '../../../Card/containers/CardModal';
import { updateBoard } from '../../api';
import { createList, updateList, archiveList, deleteList, reorderLists } from '../../../List/api';
import { createCard } from '../../../Card/api';
import { moveCard } from '../../api/card';

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
  const [, setSearchParams] = useSearchParams();

  const board = useAppSelector(selectBoard);
  const listOrder = useAppSelector(selectListOrder);
  const lists = useAppSelector(selectLists);
  const cardsByList = useAppSelector(selectCardsByList);
  const cards = useAppSelector(selectCards);
  const status = useAppSelector(selectBoardStatus);

  const api = (globalThis as unknown as { __api__: typeof __api__ }).__api__;

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
  const handleTitleSave = useCallback(
    async (title: string) => {
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
        onTitleSave={handleTitleSave}
      />
      {board.state === 'ARCHIVED' && (
        <div className="mx-4 mt-2 rounded border border-yellow-700 bg-yellow-900/30 px-4 py-2 text-sm text-yellow-400">
          This board is archived and read-only.
        </div>
      )}
      <BoardCanvas
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
    </div>
  );
};

export default BoardPage;
