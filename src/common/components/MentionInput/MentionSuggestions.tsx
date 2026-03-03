// Floating dropdown showing filtered member suggestions triggered by @.
import MentionChipRow from './MentionChip';

interface Suggestion {
  id: string;
  nickname: string;
  name: string;
  avatar_url: string | null;
}

interface Props {
  suggestions: Suggestion[];
  highlightedIndex: number;
  position: { top: number; left: number } | null;
  onSelect: (suggestion: Suggestion) => void;
  onHighlight: (index: number) => void;
}

const MentionSuggestions = ({
  suggestions,
  highlightedIndex,
  position,
  onSelect,
  onHighlight,
}: Props) => {
  if (!suggestions.length || !position) return null;

  return (
    <ul
      role="listbox"
      aria-label="Mention suggestions"
      className="absolute z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-xl min-w-[220px] max-h-[260px] overflow-y-auto"
      style={{ top: position.top, left: position.left }}
    >
      {suggestions.map((s, i) => (
        <li key={s.id} role="presentation">
          <MentionChipRow
            nickname={s.nickname}
            name={s.name}
            avatarUrl={s.avatar_url}
            highlighted={i === highlightedIndex}
            onSelect={() => onSelect(s)}
            onMouseEnter={() => onHighlight(i)}
          />
        </li>
      ))}
    </ul>
  );
};

export default MentionSuggestions;
