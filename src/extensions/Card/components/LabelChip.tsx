// LabelChip — small colored badge displaying a label name.
import type { Label } from '../api';

interface Props {
  label: Label;
  onRemove?: () => void;
}

export const LabelChip = ({ label, onRemove }: Props) => (
  <span
    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
    style={{ backgroundColor: label.color }}
    title={label.name}
  >
    {label.name}
    {onRemove && (
      <button
        type="button"
        className="ml-0.5 rounded-full hover:bg-white/20 focus:outline-none"
        onClick={onRemove}
        aria-label={`Remove label ${label.name}`}
      >
        ×
      </button>
    )}
  </span>
);
