// configFieldRenderer — shared helper that renders a single dynamic config form field
// based on the field definition from the configSchema.
// Falls back to a plain text input for unknown types.
import type { JSX } from 'react';

export interface FieldDef {
  type: string;
  label: string;
  options?: { value: string; label: string }[];
  required?: boolean;
}

interface RenderArgs {
  key: string;
  fieldDef: FieldDef;
  value: unknown;
  onChange: (val: unknown) => void;
}

export function renderConfigField({ key, fieldDef, value, onChange }: RenderArgs): JSX.Element {
  const id = `cfg-${key}`;
  const label = (
    <label htmlFor={id} className="block text-xs font-medium text-slate-400 mb-1">
      {fieldDef.label}
      {fieldDef.required && <span className="ml-1 text-red-400">*</span>}
    </label>
  );

  if (fieldDef.type === 'select' && fieldDef.options) {
    return (
      <div key={key}>
        {label}
        <select
          id={id}
          className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          required={fieldDef.required}
        >
          <option value="">Choose…</option>
          {fieldDef.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (fieldDef.type === 'boolean') {
    return (
      <div key={key} className="flex items-center gap-2">
        <input
          id={id}
          type="checkbox"
          className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-2 focus:ring-blue-500"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
        />
        <label htmlFor={id} className="text-xs font-medium text-slate-400">
          {fieldDef.label}
        </label>
      </div>
    );
  }

  if (fieldDef.type === 'number') {
    return (
      <div key={key}>
        {label}
        <input
          id={id}
          type="number"
          className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={typeof value === 'number' ? value : ''}
          onChange={(e) => onChange(Number(e.target.value))}
          required={fieldDef.required}
        />
      </div>
    );
  }

  // Default: text input (covers 'string' type and any unknown types)
  return (
    <div key={key}>
      {label}
      <input
        id={id}
        type="text"
        className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        required={fieldDef.required}
      />
    </div>
  );
}
