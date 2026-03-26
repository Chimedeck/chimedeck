// Chip rendered for a single @mention suggestion row in the dropdown.
// Shows avatar (or initials fallback), nickname, and full name.
interface Props {
  nickname: string;
  name: string;
  avatarUrl: string | null;
  highlighted: boolean;
  onSelect: () => void;
  onMouseEnter: () => void;
}

const MentionChipRow = ({ nickname, name, avatarUrl, highlighted, onSelect, onMouseEnter }: Props) => {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      role="option"
      aria-selected={highlighted}
      className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${
        highlighted ? 'bg-bg-overlay' : 'hover:bg-bg-overlay'
      }`}
      onMouseDown={(e) => {
        // Prevent blur on textarea before selection
        e.preventDefault();
        onSelect();
      }}
      onMouseEnter={onMouseEnter}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="w-7 h-7 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <span className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-inverse text-xs font-semibold flex-shrink-0">
          {initials}
        </span>
      )}
      <span className="text-sm font-medium text-base">@{nickname}</span>
      <span className="text-xs text-muted truncate">{name}</span>
    </div>
  );
};

export default MentionChipRow;
