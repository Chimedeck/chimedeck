// DropdownFieldEditor — colour-coded options editor for DROPDOWN custom fields.
// Renders a list of existing options with inline label/colour editing, plus an
// "Add option" button.
import { useState } from 'react';
import translations from './translations/en.json';
import type { DropdownOption } from './types';

// Preset colour palette for quick selection.
const PRESET_COLORS = [
  '#EF4444', // red
  '#F97316', // orange
  '#EAB308', // yellow
  '#22C55E', // green
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#6B7280', // gray
];

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
        <p className="text-xs text-slate-500 italic">{translations['CustomFields.dropdownNoOptions']}</p>
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
              <div className="absolute left-0 top-8 z-10 bg-slate-800 border border-slate-600 rounded p-2 grid grid-cols-4 gap-1 shadow-lg">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="w-5 h-5 rounded hover:scale-110 transition-transform focus:outline-none focus:ring-1 focus:ring-white"
                    style={{ backgroundColor: c }}
                    aria-label={`Select colour ${c}`}
                    onClick={() => handleColorChange(option.id, c)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Label input */}
          <input
            type="text"
            value={option.label}
            onChange={(e) => handleLabelChange(option.id, e.target.value)}
            placeholder={translations['CustomFields.dropdownOptionPlaceholder']}
            className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            aria-label={`Label for dropdown option`}
          />

          {/* Remove button */}
          <button
            type="button"
            onClick={() => handleRemoveOption(option.id)}
            className="text-slate-500 hover:text-red-400 transition-colors text-xs px-1"
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
