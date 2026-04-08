// BoardCard — summary tile for a single board in the board list.
import type { Board } from '../api';
import BoardStateChip from './BoardStateChip';
import VisibilityBadge from './VisibilityBadge';

interface Props {
  board: Board;
  onClick: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onStar?: () => void;
  onUnstar?: () => void;
}

const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={1.5}
    className="h-4 w-4"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
    />
  </svg>
);

const BoardCard = ({ board, onClick, onArchive, onDelete, onDuplicate, onStar, onUnstar }: Props) => {
  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (board.isStarred) {
      onUnstar?.();
    } else {
      onStar?.();
    }
  };

  return (
    <div
      className="flex cursor-pointer flex-col gap-2 rounded-lg border border-border bg-bg-surface shadow-sm hover:shadow-md overflow-hidden"
      onClick={onClick}
    >
      {/* Background thumbnail — shown when board has a background image */}
      {board.background ? (
        <div className="relative h-20 w-full overflow-hidden">
          <img
            src={board.background}
            alt=""
            className="h-full w-full object-cover"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-black/20" aria-hidden="true" />
        </div>
      ) : (
        <div className="h-20 w-full bg-gradient-to-br from-indigo-500/20 to-blue-600/20" />
      )}

      <div className="flex flex-col gap-2 p-4 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="truncate text-sm font-semibold text-base">{board.title}</h3>
          <div className="flex items-center gap-2">
            <VisibilityBadge visibility={board.visibility} />
            <BoardStateChip state={board.state} />
            <button
              aria-label={board.isStarred ? 'Unstar board' : 'Star board'}
              onClick={handleStarClick}
              className={`rounded p-0.5 transition-colors hover:bg-bg-overlay ${
                board.isStarred ? 'text-yellow-500' : 'text-muted'
              }`}
            >
              <StarIcon filled={!!board.isStarred} />
            </button>
          </div>
        </div>

        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            className="text-xs text-blue-600 hover:underline"
            onClick={onDuplicate}
          >
            Duplicate
          </button>
          <button
            className="text-xs text-amber-700 dark:text-yellow-400 hover:underline"
            onClick={onArchive}
          >
            {board.state === 'ARCHIVED' ? 'Unarchive' : 'Archive'}
          </button>
          <button
            className="text-xs text-danger hover:underline"
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default BoardCard;
