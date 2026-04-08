// CardActionMenu — archive, delete, copy link, copy card actions for the modal sidebar.
import { ArchiveBoxIcon, ArchiveBoxXMarkIcon, DocumentDuplicateIcon, LinkIcon, TrashIcon } from '@heroicons/react/24/outline';

interface Props {
  archived: boolean;
  onArchive: () => Promise<void>;
  onDelete: () => Promise<void>;
  onCopyLink: () => void;
  onCopyCard: () => void;
  disabled?: boolean;
}

const CardActionMenu = ({ archived, onArchive, onDelete, onCopyLink, onCopyCard, disabled }: Props) => {
  return (
    <div className="space-y-1">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-base hover:bg-bg-overlay rounded-lg transition-colors disabled:opacity-40"
        onClick={onArchive}
        disabled={disabled}
      >
        {archived
          ? <><ArchiveBoxXMarkIcon className="w-4 h-4 shrink-0" /> Unarchive card</>
          : <><ArchiveBoxIcon className="w-4 h-4 shrink-0" /> Archive card</>}
      </button>
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-base hover:bg-bg-overlay rounded-lg transition-colors"
        onClick={onCopyLink}
      >
        <LinkIcon className="w-4 h-4 shrink-0" /> Copy link
      </button>
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-base hover:bg-bg-overlay rounded-lg transition-colors disabled:opacity-40"
        onClick={onCopyCard}
        disabled={disabled}
      >
        <DocumentDuplicateIcon className="w-4 h-4 shrink-0" /> Copy card
      </button>
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-40"
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
