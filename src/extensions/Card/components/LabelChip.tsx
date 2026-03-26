// LabelChip — small colored badge displaying a label name.
import type { Label } from '../api';
import Button from '../../../common/components/Button';

interface Props {
  label: Label;
  onRemove?: () => void;
}

export const LabelChip = ({ label, onRemove }: Props) => (
  <span
    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white" // [theme-exception] text-white on dynamically-colored chip background
    style={{ backgroundColor: label.color }}
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
