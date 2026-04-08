// WorkspaceDashboard — workspace-scoped board grid with guest-role gating.
// GUEST users see only boards they have explicit access to (the server already
// filters them), but they also lose the Create Board button and see a (guest)
// badge on each board card.
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector } from '~/hooks/useAppSelector';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import {
  visibleBoardsSelector,
  showStarredOnlySelector,
  fetchBoardsInProgressSelector,
  fetchBoardsErrorSelector,
  fetchBoardsThunk,
  createBoardThunk,
  archiveBoardThunk,
  deleteBoardThunk,
  duplicateBoardThunk,
  starBoardThunk,
  unstarBoardThunk,
  toggleStarredFilter,
} from '~/extensions/Board/containers/BoardListPage/BoardListPage.duck';
import { selectIsGuestInActiveWorkspace } from '../../slices/workspaceSlice';
import BoardCard from '~/extensions/Board/components/BoardCard';
import CreateBoardModal from '~/extensions/Board/components/CreateBoardModal';
import { StarIcon } from '@heroicons/react/24/solid';

const WorkspaceDashboard = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId: string }>();

  const boards = useAppSelector(visibleBoardsSelector);
  const showStarredOnly = useAppSelector(showStarredOnlySelector);
  const loading = useAppSelector(fetchBoardsInProgressSelector);
  const error = useAppSelector(fetchBoardsErrorSelector);
  // [why] Derive the guest flag from callerRole on the active workspace object
  // so no extra API call is needed.
  const isGuest = useAppSelector(selectIsGuestInActiveWorkspace);

  const [showCreateModal, setShowCreateModal] = useState(false);

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
      dispatch(deleteBoardThunk({ boardId }));
    }
  };
  const handleDuplicate = (boardId: string) => dispatch(duplicateBoardThunk({ boardId }));
  const handleStar = (boardId: string) => dispatch(starBoardThunk({ boardId }));
  const handleUnstar = (boardId: string) => dispatch(unstarBoardThunk({ boardId }));

  const pageContent = (() => {
    if (loading) return <p className="text-muted">Loading boards…</p>;
    if (error) return <p className="text-danger">Failed to load boards.</p>;
    if (!boards.length) {
      return (
        <p className="text-muted">
          {showStarredOnly
            ? 'No starred boards. Star a board to add it here.'
            : isGuest
              ? 'You have not been granted access to any boards in this workspace.'
              : 'No boards yet. Create your first board to get started.'}
        </p>
      );
    }
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {boards.map((board) => (
          <div key={board.id} className="relative">
            {isGuest && (
              <span
                className="absolute right-2 top-2 z-10 rounded bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"
                aria-label="guest access"
              >
                guest
              </span>
            )}
            <BoardCard
              board={board}
              onClick={() => navigate(`/boards/${board.id}`)}
              onArchive={() => handleArchive(board.id)}
              onDelete={() => handleDelete(board.id)}
              onDuplicate={() => handleDuplicate(board.id)}
              onStar={() => handleStar(board.id)}
              onUnstar={() => handleUnstar(board.id)}
            />
          </div>
        ))}
      </div>
    );
  })();

  return (
    <div className="px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-base">Boards</h1>
          {isGuest && (
            <span className="rounded-md bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-sm font-medium text-amber-700 dark:text-amber-400">
              guest access
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => dispatch(toggleStarredFilter())}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              showStarredOnly
                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                : 'text-muted hover:bg-bg-overlay dark:hover:bg-slate-800'
            }`}
            aria-pressed={showStarredOnly}
          >
            <StarIcon className="h-4 w-4" aria-hidden="true" />
            Starred
          </button>
          {/* [why] GUEST users cannot create boards — they are scoped to granted boards only. */}
          {!isGuest && (
            <button
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors" // [theme-exception] text-white on primary button
              onClick={() => setShowCreateModal(true)}
            >
              Create Board
            </button>
          )}
        </div>
      </div>
      {pageContent}
      {showCreateModal && (
        <CreateBoardModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
};

export default WorkspaceDashboard;
