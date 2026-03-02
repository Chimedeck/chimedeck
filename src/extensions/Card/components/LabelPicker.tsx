// LabelPicker — multi-select dropdown for workspace labels.
import { useState } from 'react';
import type { Label } from '../api';
import { LabelChip } from './LabelChip';

interface Props {
  allLabels: Label[];
  selectedIds: string[];
  onAttach: (labelId: string) => Promise<void>;
  onDetach: (labelId: string) => Promise<void>;
  disabled?: boolean;
}

export const LabelPicker = ({ allLabels, selectedIds, onAttach, onDetach, disabled }: Props) => {
  const [open, setOpen] = useState(false);

  const toggle = async (label: Label) => {
    if (disabled) return;
    if (selectedIds.includes(label.id)) {
      await onDetach(label.id);
    } else {
      await onAttach(label.id);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        Labels ▾
      </button>
      {open && (
        <div
          className="absolute z-10 mt-1 w-48 rounded-md border border-gray-200 bg-white shadow-lg"
          role="listbox"
          aria-multiselectable="true"
        >
          {allLabels.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-400">No labels in workspace</p>
          )}
          {allLabels.map((label) => {
            const selected = selectedIds.includes(label.id);
            return (
              <button
                key={label.id}
                type="button"
                role="option"
                aria-selected={selected}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                onClick={() => toggle(label)}
              >
                <span
                  className="h-3 w-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: label.color }}
                />
                <span className="flex-1 truncate">{label.name}</span>
                {selected && <span className="text-blue-500">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
