// LabelsSection — displays assigned labels and a picker for attaching/detaching.
import type { Label } from '../../../api';
import { LabelChip } from '../../../components/LabelChip';
import { LabelPicker } from '../../../components/LabelPicker';

interface Props {
  allLabels: Label[];
  assignedLabels: Label[];
  onAttach: (labelId: string) => Promise<void>;
  onDetach: (labelId: string) => Promise<void>;
  disabled?: boolean;
}

export const LabelsSection = ({ allLabels, assignedLabels, onAttach, onDetach, disabled }: Props) => (
  <section aria-label="Labels">
    <h3 className="mb-1 text-sm font-semibold text-gray-700 dark:text-slate-300">Labels</h3>
    <div className="flex flex-wrap items-center gap-1">
      {assignedLabels.map((label) => (
        <LabelChip
          key={label.id}
          label={label}
          {...(!disabled && { onRemove: () => onDetach(label.id) })}
        />
      ))}
      {!disabled && (
        <LabelPicker
          allLabels={allLabels}
          selectedIds={assignedLabels.map((l) => l.id)}
          onAttach={onAttach}
          onDetach={onDetach}
        />
      )}
    </div>
  </section>
);
