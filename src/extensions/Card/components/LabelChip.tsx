// LabelChip — small colored badge displaying a label name.
import type { Label } from '../api';
import Button from '../../../common/components/Button';

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

interface Props {
  label: Label;
  onRemove?: () => void;
}

export const LabelChip = ({ label, onRemove }: Props) => (
  <span
    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
    style={{ backgroundColor: label.color, color: contrastText(label.color) }}
    title={label.name}
  >
    {label.name}
    {onRemove && (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="ml-0.5 rounded-full hover:bg-white/20"
        onClick={onRemove}
        aria-label={`Remove label ${label.name}`}
      >
        ×
      </Button>
    )}
  </span>
);
