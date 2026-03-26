// CardLabels — label chips + label picker popover for the card modal sidebar.
// Supports assign/unassign existing labels and creates new ones inline.
import { useState } from 'react';
import type { Label } from '../api';
import { LabelChip } from './LabelChip';
import Button from '../../../common/components/Button';

const PRESET_COLORS = [
  { name: 'Slate', hex: '#64748b' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Purple', hex: '#a855f7' },
];

interface Props {
  assignedLabels: Label[];
  allLabels: Label[];
  onAttach: (labelId: string) => Promise<void>;
  onDetach: (labelId: string) => Promise<void>;
  onCreateAndAttach: (name: string, color: string) => Promise<void>;
  disabled?: boolean;
}

const CardLabels = ({
  assignedLabels,
  allLabels,
  onAttach,
  onDetach,
  onCreateAndAttach,
  disabled,
}: Props) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[6].hex);
  const [creating, setCreating] = useState(false);

  const assignedIds = new Set(assignedLabels.map((l) => l.id));

  const handleToggle = async (label: Label) => {
    if (assignedIds.has(label.id)) {
      await onDetach(label.id);
    } else {
      await onAttach(label.id);
    }
  };

  const handleCreate = async () => {
    const name = newLabelName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await onCreateAndAttach(name, selectedColor);
      setNewLabelName('');
      // Close the picker after successfully creating + attaching the label
      setPickerOpen(false);
    } finally {
      setCreating(false);
    }
  };

  // Labels not yet assigned, filtered by name search
  const unassigned = allLabels.filter(
    (l) => !assignedIds.has(l.id) && l.name.toLowerCase().includes(newLabelName.toLowerCase()),
  );

  return (
    <div>
      {/* Assigned label chips */}
      <div className="flex flex-wrap gap-1 mb-2">
        {assignedLabels.map((label) => (
          <LabelChip
            key={label.id}
            label={label}
            onRemove={disabled ? undefined : () => onDetach(label.id)}
          />
        ))}
      </div>

      {!disabled && (
        <div className="relative">
          <button
            type="button"
            className="text-xs text-muted hover:text-base flex items-center gap-1 transition-colors"
            onClick={() => setPickerOpen((v) => !v)}
            aria-haspopup="true"
            aria-expanded={pickerOpen}
          >
            + Add label
          </button>

          {pickerOpen && (
            <>
              {/* Backdrop to close picker */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setPickerOpen(false)}
                aria-hidden="true"
              />
              <div className="absolute left-0 top-6 z-20 w-64 rounded-xl bg-bg-surface border border-border shadow-2xl p-3 space-y-3">
                {/* Search / create input */}
                <input
                  className="w-full bg-bg-overlay border border-border rounded-lg px-2 py-1.5 text-sm text-base placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Label name…"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                  autoFocus
                />

                {/* Colour grid */}
                <div>
                  <p className="text-xs text-muted mb-1.5">Colour</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        title={c.name}
                        className={`h-7 w-full rounded-md transition-transform hover:scale-110 focus:outline-none ${
                          selectedColor === c.hex ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800' : ''
                        }`}
                        style={{ backgroundColor: c.hex }}
                        onClick={() => setSelectedColor(c.hex)}
                        aria-label={c.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Create button */}
                {newLabelName.trim() && (
                  <Button
                    variant="primary"
                    type="button"
                    className="w-full py-1.5 rounded-lg text-sm"
                    onClick={handleCreate}
                    disabled={creating}
                  >
                    {creating ? 'Creating…' : `Create "${newLabelName.trim()}"`}
                  </Button>
                )}

                {/* Existing unassigned labels */}
                {unassigned.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted">Existing labels</p>
                    {unassigned.map((label) => (
                      <button
                        key={label.id}
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-base hover:bg-bg-overlay transition-colors"
                        onClick={() => handleToggle(label)}
                      >
                        <span
                          className="h-3 w-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: label.color }}
                        />
                        {label.name}
                      </button>
                    ))}
                  </div>
                )}

                {/* Already assigned labels (toggle off) */}
                {assignedLabels.length > 0 && (
                  <div className="space-y-1 border-t border-border pt-2">
                    <p className="text-xs text-muted">Assigned</p>
                    {assignedLabels.map((label) => (
                      <button
                        key={label.id}
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-base hover:bg-bg-overlay transition-colors"
                        onClick={() => handleToggle(label)}
                      >
                        <span
                          className="h-3 w-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: label.color }}
                        />
                        {label.name}
                        <span className="ml-auto text-emerald-400">✓</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default CardLabels;
