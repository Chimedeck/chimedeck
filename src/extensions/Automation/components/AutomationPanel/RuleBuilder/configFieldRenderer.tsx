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

// Shape of a single property in the JSON Schema produced by z.toJSONSchema.
interface JsonSchemaProp {
  type?: string;
  enum?: string[];
  format?: string;
}

interface JsonSchema {
  properties?: Record<string, JsonSchemaProp>;
  required?: string[];
}

// Convert a camelCase key to a human-readable label: "listId" → "List ID".
function camelToLabel(key: string): string {
  const spaced = key.replaceAll(/([A-Z])/g, ' $1');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Parse the raw JSON Schema object (from z.toJSONSchema) into an ordered list of field defs. */
export function parseConfigSchema(schema: unknown): Array<{ key: string; fieldDef: FieldDef }> {
  const js = schema as JsonSchema;
  const properties = js?.properties ?? {};
  const requiredSet = new Set(js?.required ?? []);

  return Object.entries(properties).map(([key, prop]) => {
    const required = requiredSet.has(key);
    const label = camelToLabel(key);

    if (prop.enum) {
      return {
        key,
        fieldDef: {
          type: 'select',
          label,
          required,
          options: prop.enum.map((v) => ({ value: v, label: camelToLabel(v) })),
        } satisfies FieldDef,
      };
    }

    // UUID fields whose key ends in "listId" reference a board list — render as a list picker.
    if (prop.format === 'uuid' && /listId$/i.test(key)) {
      return { key, fieldDef: { type: 'list-select', label, required } satisfies FieldDef };
    }

    if (prop.type === 'integer' || prop.type === 'number') {
      return { key, fieldDef: { type: 'number', label, required } satisfies FieldDef };
    }

    return { key, fieldDef: { type: 'string', label, required } satisfies FieldDef };
  });
}

/** True if the JSON Schema has at least one configurable property. */
export function hasConfigFields(schema: unknown): boolean {
  return Object.keys((schema as JsonSchema)?.properties ?? {}).length > 0;
}

interface RenderArgs {
  key: string;
  fieldDef: FieldDef;
  value: unknown;
  onChange: (val: unknown) => void;
  boardLists?: { id: string; title: string }[];
}

export function renderConfigField({ key, fieldDef, value, onChange, boardLists }: RenderArgs): JSX.Element {
  const id = `cfg-${key}`;
  const label = (
    <label htmlFor={id} className="block text-xs font-medium text-slate-400 mb-1">
      {fieldDef.label}
      {fieldDef.required && <span className="ml-1 text-red-400">*</span>}
    </label>
  );

  if (fieldDef.type === 'list-select') {
    return (
      <div key={key}>
        {label}
        <select
          id={id}
          className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          required={fieldDef.required}
        >
          <option value="">Any list…</option>
          {(boardLists ?? []).map((list) => (
            <option key={list.id} value={list.id}>
              {list.title}
            </option>
          ))}
        </select>
      </div>
    );
  }

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
