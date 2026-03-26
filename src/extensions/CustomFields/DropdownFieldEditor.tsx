// DropdownFieldEditor — colour-coded options editor for DROPDOWN custom fields.
// Renders a list of existing options with inline label/colour editing, plus an
// "Add option" button.
import { useState, useEffect, useRef } from 'react';
import translations from './translations/en.json';
import type { DropdownOption } from './types';

// Preset colour palette for quick selection (4-column grid = 3 rows of 4).
const PRESET_COLORS = [
  '#EF4444', // red
  '#DC2626', // dark red
  '#F97316', // orange
  '#EAB308', // yellow
  '#22C55E', // green
  '#059669', // emerald
  '#3B82F6', // blue
  '#1D4ED8', // dark blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#6B7280', // gray
  '#0F172A', // near-black
];

interface ColorPickerPopupProps {
  currentColor: string;
  onSelect: (color: string) => void;
  onClose: () => void;
}

// Standalone popup so it can close itself on outside click without polluting
// DropdownFieldEditor's event handlers.
const ColorPickerPopup = ({ currentColor, onSelect, onClose }: ColorPickerPopupProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute left-0 top-8 z-20 bg-slate-900 border border-slate-600 rounded-lg p-4 shadow-xl w-48"
    >
      <p className="text-xs font-medium text-subtle mb-2">Colour</p>
      <div className="grid grid-cols-4 gap-3">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className="relative w-8 h-8 rounded-full hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-white/50 flex items-center justify-center"
            style={{ backgroundColor: c }}
            aria-label={`Select colour ${c}`}
            onClick={() => onSelect(c)}
          >
            {c === currentColor && (
              <span className="text-white text-xs font-bold drop-shadow" aria-hidden="true">✓</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

interface Props {
  options: DropdownOption[];
  onChange: (options: DropdownOption[]) => void;
}

const DropdownFieldEditor = ({ options, onChange }: Props) => {
  const [colorPickerOpenId, setColorPickerOpenId] = useState<string | null>(null);

  const handleLabelChange = (id: string, label: string) => {
    onChange(options.map((o) => (o.id === id ? { ...o, label } : o)));
  };

  const handleColorChange = (id: string, color: string) => {
    onChange(options.map((o) => (o.id === id ? { ...o, color } : o)));
    setColorPickerOpenId(null);
  };

  const handleAddOption = () => {
    const newOption: DropdownOption = {
      id: crypto.randomUUID(),
      label: '',
      color: PRESET_COLORS[options.length % PRESET_COLORS.length] ?? '#6B7280',
    };
    onChange([...options, newOption]);
  };

  const handleRemoveOption = (id: string) => {
    onChange(options.filter((o) => o.id !== id));
  };

  return (
    <div className="space-y-2" aria-label={translations['CustomFields.dropdownEditorLabel']}>
      {options.length === 0 && (
        <p className="text-xs text-muted italic">{translations['CustomFields.dropdownNoOptions']}</p>
      )}

      {options.map((option) => (
        <div key={option.id} className="flex items-center gap-2">
          {/* Colour swatch / picker trigger */}
          <div className="relative">
            <button
              type="button"
              className="w-6 h-6 rounded border border-slate-600 flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ backgroundColor: option.color }}
              aria-label={`Pick colour for option ${option.label}`}
              onClick={() =>
                setColorPickerOpenId(colorPickerOpenId === option.id ? null : option.id)
              }
            />
            {colorPickerOpenId === option.id && (
              <ColorPickerPopup
                currentColor={option.color}
                onSelect={(c) => handleColorChange(option.id, c)}
                onClose={() => setColorPickerOpenId(null)}
              />
            )}
          </div>

          {/* Label input */}
          <input
            type="text"
            value={option.label}
            onChange={(e) => handleLabelChange(option.id, e.target.value)}
            placeholder={translations['CustomFields.dropdownOptionPlaceholder']}
            className="flex-1 bg-bg-overlay border border-border rounded px-2 py-1 text-sm text-base placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label={`Label for dropdown option`}
          />

          {/* Remove button */}
          <button
            type="button"
            onClick={() => handleRemoveOption(option.id)}
            className="text-muted hover:text-danger transition-colors text-xs px-1"
            aria-label={`Remove option ${option.label}`}
          >
            ✕
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={handleAddOption}
        className="w-full text-left text-xs text-blue-400 hover:text-blue-300 transition-colors py-1"
      >
        {translations['CustomFields.dropdownAddOption']}
      </button>
    </div>
  );
};

export default DropdownFieldEditor;
