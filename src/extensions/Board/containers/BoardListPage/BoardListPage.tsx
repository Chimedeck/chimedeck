// BoardListPage — shows all boards in a workspace; supports create, archive, delete, duplicate.
// Sprint 48: adds star/unstar per board tile and a "Starred boards" filter chip.
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector } from '~/hooks/useAppSelector';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import BoardCard from '../../components/BoardCard';
import CreateBoardModal from '../../components/CreateBoardModal';
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
} from './BoardListPage.duck';

const BoardListPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId: string }>();

  const boards = useAppSelector(visibleBoardsSelector);
  const showStarredOnly = useAppSelector(showStarredOnlySelector);
  const loading = useAppSelector(fetchBoardsInProgressSelector);
  const error = useAppSelector(fetchBoardsErrorSelector);

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
    if (loading) return <p className="text-gray-500">Loading boards…</p>;
    if (error) return <p className="text-red-600">Failed to load boards.</p>;
    if (!boards.length) {
      return (
        <p className="text-gray-500">
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
        <h1 className="text-2xl font-bold text-gray-900">Boards</h1>
        <button
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          onClick={() => setShowCreateModal(true)}
        >
          Create Board
        </button>
      </div>

      {/* Filter chips */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => dispatch(toggleStarredFilter())}
          className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            showStarredOnly
              ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
              : 'border-gray-300 bg-white text-gray-600 hover:border-yellow-400 hover:text-yellow-600'
          }`}
        >
          <span>⭐</span>
          <span>Starred boards</span>
        </button>
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

export default BoardListPage;
