// BoardListPage — shows all boards in a workspace; supports create, archive, delete, duplicate.
// Sprint 48: adds star/unstar per board tile and a "Starred boards" filter chip.
// Sprint 87: reads navigate state to display success toast after board-deletion redirect.
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { StarIcon } from '@heroicons/react/24/solid';
import { useAppSelector } from '~/hooks/useAppSelector';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import BoardCard from '../../components/BoardCard';
import CreateBoardModal from '../../components/CreateBoardModal';
import ToastRegion from '~/common/components/ToastRegion';
import type { ToastItem } from '~/common/components/ToastRegion';
import {
  visibleBoardsSelector,
  showStarredOnlySelector,
  fetchBoardsInProgressSelector,
  fetchBoardsErrorSelector,
  fetchBoardsThunk,
  createBoardThunk,
  archiveBoardThunk,
  deleteBoardOptimisticThunk,
  duplicateBoardThunk,
  starBoardThunk,
  unstarBoardThunk,
  toggleStarredFilter,
} from './BoardListPage.duck';

const BoardListPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { workspaceId } = useParams<{ workspaceId: string }>();

  const boards = useAppSelector(visibleBoardsSelector);
  const showStarredOnly = useAppSelector(showStarredOnlySelector);
  const loading = useAppSelector(fetchBoardsInProgressSelector);
  const error = useAppSelector(fetchBoardsErrorSelector);

  const [showCreateModal, setShowCreateModal] = useState(false);

  // ── Toast notifications ───────────────────────────────────────────────────
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const addToast = useCallback((message: string, variant: ToastItem['variant'] = 'info') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, variant }]);
  }, []);
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Show one-shot toast passed via navigate state (e.g. after board-deletion redirect).
  // [why] Empty deps: only consume the state once on mount, not on every re-render.
  useEffect(() => {
    const state = location.state as { successToast?: string } | null;
    if (state?.successToast) {
      addToast(state.successToast, 'info');
      // Clear the router state so the toast doesn't reappear if the user navigates back.
      window.history.replaceState({}, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (workspaceId) dispatch(fetchBoardsThunk({ workspaceId }));
  }, [dispatch, workspaceId]);

  const handleCreate = (title: string) => {
    if (!workspaceId) return;
    dispatch(createBoardThunk({ workspaceId, title }));
    setShowCreateModal(false);
  };

  const handleArchive = (boardId: string) => dispatch(archiveBoardThunk({ boardId }));

  const handleDelete = (boardId: string) => {
    if (window.confirm('Are you sure you want to delete this board? This cannot be undone.')) {
      dispatch(deleteBoardOptimisticThunk({ boardId }));
    }
  };

  const handleDuplicate = (boardId: string) => dispatch(duplicateBoardThunk({ boardId }));

  const handleStar = (boardId: string) => dispatch(starBoardThunk({ boardId }));
  const handleUnstar = (boardId: string) => dispatch(unstarBoardThunk({ boardId }));

  const pageContent = (() => {
    if (loading) return <p className="text-slate-500 dark:text-slate-400">Loading boards…</p>;
    if (error) return <p className="text-red-400">Failed to load boards.</p>;
    if (!boards.length) {
      return (
        <p className="text-slate-500 dark:text-slate-400">
          {showStarredOnly
            ? 'No starred boards. Star a board to add it here.'
            : 'No boards yet. Create your first board to get started.'}
        </p>
      );
    }
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {boards.map((board) => (
          <BoardCard
            key={board.id}
            board={board}
            onClick={() => navigate(`/boards/${board.id}`)}
            onArchive={() => handleArchive(board.id)}
            onDelete={() => handleDelete(board.id)}
            onDuplicate={() => handleDuplicate(board.id)}
            onStar={() => handleStar(board.id)}
            onUnstar={() => handleUnstar(board.id)}
          />
        ))}
      </div>
    );
  })();

  return (
    <div className="px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Boards</h1>
        <button
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          onClick={() => setShowCreateModal(true)}
        >
          Create Board
        </button>
      </div>

      {/* Filter chips — radio-group style so current state is always explicit */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs text-slate-400 dark:text-slate-500">Show:</span>
        <button
          onClick={() => showStarredOnly && dispatch(toggleStarredFilter())}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            !showStarredOnly
              ? 'border-slate-500 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
              : 'border-slate-200 dark:border-slate-700 bg-transparent text-slate-400 dark:text-slate-500 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          All boards
        </button>
        <button
          onClick={() => !showStarredOnly && dispatch(toggleStarredFilter())}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            showStarredOnly
              ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400'
              : 'border-slate-200 dark:border-slate-700 bg-transparent text-slate-400 dark:text-slate-500 hover:border-yellow-500 hover:text-yellow-400'
          }`}
        >
          <StarIcon className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Starred only</span>
        </button>
      </div>

      {pageContent}
      {showCreateModal && (
        <CreateBoardModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}
      <ToastRegion toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default BoardListPage;
