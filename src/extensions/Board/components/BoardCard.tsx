// BoardCard — summary tile for a single board in the board list.
import type { Board } from '../api';
import BoardStateChip from './BoardStateChip';

interface Props {
  board: Board;
  onClick: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

const BoardCard = ({ board, onClick, onArchive, onDelete, onDuplicate }: Props) => {
  return (
    <div
      className="flex cursor-pointer flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <h3 className="truncate text-base font-semibold text-gray-900">{board.title}</h3>
        <BoardStateChip state={board.state} />
      </div>

      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          className="text-xs text-blue-600 hover:underline"
          onClick={onDuplicate}
        >
          Duplicate
        </button>
        <button
          className="text-xs text-yellow-600 hover:underline"
          onClick={onArchive}
        >
          {board.state === 'ARCHIVED' ? 'Unarchive' : 'Archive'}
        </button>
        <button
          className="text-xs text-red-600 hover:underline"
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default BoardCard;
