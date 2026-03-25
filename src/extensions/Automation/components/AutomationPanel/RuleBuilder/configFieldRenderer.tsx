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

export interface BoardOption {
  id: string;
  title: string;
}

export interface ListOption {
  id: string;
  title: string;
}

// Shape of a single property in the JSON Schema produced by z.toJSONSchema.
interface JsonSchemaProp {
  type?: string;
  enum?: string[];
  format?: string;
  items?: { type?: string; format?: string };
  minLength?: number;
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

    // Array of UUIDs whose key ends in "listIds" → multi-select list picker.
    if (prop.type === 'array' && /listIds$/i.test(key)) {
      return { key, fieldDef: { type: 'list-multi-select', label, required } satisfies FieldDef };
    }

    // UUID fields whose key is exactly "targetBoardId" → board picker for cross-board actions.
    if ((prop.type === 'string' || prop.format === 'uuid') && key === 'targetBoardId') {
      return { key, fieldDef: { type: 'board-select', label, required } satisfies FieldDef };
    }

    // UUID fields whose key ends in "targetListId" → list picker that reads from targetBoardId.
    if ((prop.type === 'string' || prop.format === 'uuid') && /targetListId$/i.test(key)) {
      return { key, fieldDef: { type: 'target-list-select', label, required } satisfies FieldDef };
    }

    // UUID fields whose key ends in "listId" reference a board list — render as a list picker.
    if ((prop.type === 'string' || prop.format === 'uuid') && /listId$/i.test(key)) {
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
  workspaceBoards?: BoardOption[];
  targetBoardLists?: ListOption[];
}

const SELECT_CLASS = 'w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500';
const INPUT_CLASS = 'w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500';

function FieldLabel({ id, label, required }: Readonly<{ id: string; label: string; required?: boolean }>) {
  return (
    <label htmlFor={id} className="block text-xs font-medium text-slate-400 mb-1">
      {label}
      {required && <span className="ml-1 text-red-400">*</span>}
    </label>
  );
}

function renderListSelect(args: RenderArgs): JSX.Element {
  const { key, fieldDef, value, onChange, boardLists } = args;
  const id = `cfg-${key}`;
  return (
    <div key={key}>
      <FieldLabel id={id} label={fieldDef.label} required={fieldDef.required} />
      <select id={id} className={SELECT_CLASS} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value || undefined)} required={fieldDef.required}>
        <option value="">Any list…</option>
        {(boardLists ?? []).map((list) => <option key={list.id} value={list.id}>{list.title}</option>)}
      </select>
    </div>
  );
}

function renderListMultiSelect(args: RenderArgs): JSX.Element {
  const { key, fieldDef, boardLists } = args;
  const lists = boardLists ?? [];
  const selected: string[] = Array.isArray(args.value) ? (args.value as string[]) : [];

  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    args.onChange(next.length > 0 ? next : undefined);
  };

  return (
    <div key={key}>
      <span className="block text-xs font-medium text-slate-400 mb-1">
        {fieldDef.label}
        <span className="ml-1 text-slate-500">(leave empty for all lists)</span>
      </span>
      {lists.length === 0 ? (
        <p className="text-xs text-slate-500 italic">Loading lists…</p>
      ) : (
        <div className="flex flex-col gap-1 max-h-40 overflow-y-auto rounded-md border border-slate-600 bg-slate-700 p-2">
          {lists.map((list) => (
            <label key={list.id} className="flex items-center gap-2 cursor-pointer text-sm text-slate-200">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-slate-500 bg-slate-600 text-blue-500 focus:ring-1 focus:ring-blue-500"
                checked={selected.includes(list.id)}
                onChange={() => toggle(list.id)}
              />
              {list.title}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function renderBoardSelect(args: RenderArgs): JSX.Element {
  const { key, fieldDef, value, onChange, workspaceBoards } = args;
  const id = `cfg-${key}`;
  return (
    <div key={key}>
      <FieldLabel id={id} label={fieldDef.label} required={fieldDef.required} />
      <select id={id} className={SELECT_CLASS} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value || undefined)} required={fieldDef.required}>
        <option value="">Select a board…</option>
        {(workspaceBoards ?? []).map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
      </select>
    </div>
  );
}

function renderTargetListSelect(args: RenderArgs): JSX.Element {
  const { key, fieldDef, value, onChange, targetBoardLists } = args;
  const id = `cfg-${key}`;
  const lists = targetBoardLists ?? [];
  return (
    <div key={key}>
      <FieldLabel id={id} label={fieldDef.label} required={fieldDef.required} />
      <select id={id} className={SELECT_CLASS} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value || undefined)} required={fieldDef.required} disabled={lists.length === 0}>
        <option value="">{lists.length === 0 ? 'Select a board first…' : 'Select a list…'}</option>
        {lists.map((list) => <option key={list.id} value={list.id}>{list.title}</option>)}
      </select>
    </div>
  );
}

function renderEnumSelect(args: RenderArgs): JSX.Element {
  const { key, fieldDef, value, onChange } = args;
  const id = `cfg-${key}`;
  return (
    <div key={key}>
      <FieldLabel id={id} label={fieldDef.label} required={fieldDef.required} />
      <select id={id} className={SELECT_CLASS} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} required={fieldDef.required}>
        <option value="">Choose…</option>
        {(fieldDef.options ?? []).map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </div>
  );
}

function renderBoolean(args: RenderArgs): JSX.Element {
  const { key, fieldDef, value, onChange } = args;
  const id = `cfg-${key}`;
  return (
    <div key={key} className="flex items-center gap-2">
      <input id={id} type="checkbox" className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-2 focus:ring-blue-500" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id} className="text-xs font-medium text-slate-400">{fieldDef.label}</label>
    </div>
  );
}

function renderNumber(args: RenderArgs): JSX.Element {
  const { key, fieldDef, value, onChange } = args;
  const id = `cfg-${key}`;
  return (
    <div key={key}>
      <FieldLabel id={id} label={fieldDef.label} required={fieldDef.required} />
      <input id={id} type="number" className={SELECT_CLASS} value={typeof value === 'number' ? value : ''} onChange={(e) => onChange(Number(e.target.value))} required={fieldDef.required} />
    </div>
  );
}

function renderText(args: RenderArgs): JSX.Element {
  const { key, fieldDef, value, onChange } = args;
  const id = `cfg-${key}`;
  return (
    <div key={key}>
      <FieldLabel id={id} label={fieldDef.label} required={fieldDef.required} />
      <input id={id} type="text" className={INPUT_CLASS} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} required={fieldDef.required} />
    </div>
  );
}

type TypeRenderer = (args: RenderArgs) => JSX.Element;

const TYPE_RENDERERS: Record<string, TypeRenderer> = {
  'list-select': renderListSelect,
  'list-multi-select': renderListMultiSelect,
  'board-select': renderBoardSelect,
  'target-list-select': renderTargetListSelect,
  boolean: renderBoolean,
  number: renderNumber,
};

export function renderConfigField(args: RenderArgs): JSX.Element {
  const renderer = TYPE_RENDERERS[args.fieldDef.type];
  if (renderer) return renderer(args);
  if (args.fieldDef.type === 'select' && args.fieldDef.options) return renderEnumSelect(args);
  return renderText(args);
}
