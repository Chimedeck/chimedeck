// CardLabelChips — coloured label chips for a card tile.
// Collapsed: short coloured bars; Expanded: coloured pills with label text.

/** Pick readable text colour (black or white) based on background luminance. */
function contrastText(bgHex: string): string {
  const hex = bgHex.trim().replace('#', '');
  const normalized =
    hex.length === 3
      ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
      : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return 'var(--text-inverse)';
  const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.3 ? 'var(--text-base)' : 'var(--text-inverse)';
}

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
      className="mb-1.5 flex flex-wrap gap-1 cursor-pointer"
      aria-label="Card labels"
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
      title={expanded ? 'Collapse labels' : 'Expand labels'}
    >
      {labels.map((label) =>
        expanded ? (
          <span
            key={label.id}
            className="inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full truncate max-w-[120px] transition-all duration-150"
            style={{ backgroundColor: label.color, color: contrastText(label.color) }}
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
