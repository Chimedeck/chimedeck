// CardLabelChips — coloured label chips for a card tile.
// Collapsed: short coloured bars; Expanded: coloured pills with label text.
interface LabelChip {
  id: string;
  name: string;
  color: string;
}

interface Props {
  labels: LabelChip[];
  expanded: boolean;
  onToggle: () => void;
}

const CardLabelChips = ({ labels, expanded, onToggle }: Props) => {
  if (labels.length === 0) return null;

  return (
    <div
      className="flex flex-wrap gap-1 mb-1.5"
      aria-label="Card labels"
      aria-expanded={expanded}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.stopPropagation();
          onToggle();
        }
      }}
      role="button"
      tabIndex={0}
      title={expanded ? 'Collapse labels' : 'Expand labels'}
    >
      {/* [theme-exception] text-white on arbitrary label background color */}
      {labels.map((label) =>
        expanded ? (
          <span
            key={label.id}
            className="inline-block px-2 py-0.5 text-[11px] font-semibold text-white rounded-full truncate max-w-[120px] transition-all duration-150"
            style={{ backgroundColor: label.color }}
            title={label.name}
          >
            {label.name}
          </span>
        ) : (
          <span
            key={label.id}
            className="inline-block h-2 rounded-full min-w-[28px] max-w-[40px] flex-1 transition-all duration-150"
            style={{ backgroundColor: label.color }}
            title={label.name}
          />
        ),
      )}
    </div>
  );
};

export default CardLabelChips;
