// CardActionMenu — archive, delete, copy link actions for the modal sidebar.
import { ArchiveBoxIcon, ArchiveBoxXMarkIcon, LinkIcon, TrashIcon } from '@heroicons/react/24/outline';

interface Props {
  cardId: string;
  archived: boolean;
  onArchive: () => Promise<void>;
  onDelete: () => Promise<void>;
  onCopyLink: () => void;
  disabled?: boolean;
}

const CardActionMenu = ({ archived, onArchive, onDelete, onCopyLink, disabled }: Props) => {
  return (
    <div className="space-y-1">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-40"
        onClick={onArchive}
        disabled={disabled}
      >
        {archived
          ? <><ArchiveBoxXMarkIcon className="w-4 h-4 shrink-0" /> Unarchive card</>
          : <><ArchiveBoxIcon className="w-4 h-4 shrink-0" /> Archive card</>}
      </button>
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        onClick={onCopyLink}
      >
        <LinkIcon className="w-4 h-4 shrink-0" /> Copy link
      </button>
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-40"
        onClick={() => {
          if (confirm('Delete this card? This cannot be undone.')) onDelete();
        }}
        disabled={disabled}
      >
        <TrashIcon className="w-4 h-4 shrink-0" /> Delete card
      </button>
    </div>
  );
};

export default CardActionMenu;
