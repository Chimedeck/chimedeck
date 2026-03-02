// CardActionMenu — archive, delete, copy link actions for the modal sidebar.
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
        className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-40"
        onClick={onArchive}
        disabled={disabled}
      >
        {archived ? '↩ Unarchive card' : '📦 Archive card'}
      </button>
      <button
        type="button"
        className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
        onClick={onCopyLink}
      >
        🔗 Copy link
      </button>
      <button
        type="button"
        className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-40"
        onClick={() => {
          if (confirm('Delete this card? This cannot be undone.')) onDelete();
        }}
        disabled={disabled}
      >
        🗑 Delete card
      </button>
    </div>
  );
};

export default CardActionMenu;
