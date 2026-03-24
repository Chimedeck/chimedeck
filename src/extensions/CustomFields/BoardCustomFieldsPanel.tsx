// BoardCustomFieldsPanel — manage custom field definitions inside Board Settings.
// Supports create, rename, toggle show_on_card, and delete for all field types.
// DROPDOWN fields open an inline DropdownFieldEditor for option management.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import translations from './translations/en.json';
import { apiClient } from '~/common/api/client';
import { useCustomFields, createCustomField, updateCustomField, deleteCustomField } from './api';
import type { CustomField, FieldType, DropdownOption } from './types';
import DropdownFieldEditor from './DropdownFieldEditor';

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  TEXT: translations['CustomFields.typeText'],
  NUMBER: translations['CustomFields.typeNumber'],
  DATE: translations['CustomFields.typeDate'],
  CHECKBOX: translations['CustomFields.typeCheckbox'],
  DROPDOWN: translations['CustomFields.typeDropdown'],
};

const FIELD_TYPES: FieldType[] = ['TEXT', 'NUMBER', 'DATE', 'CHECKBOX', 'DROPDOWN'];

interface NewFieldState {
  name: string;
  field_type: FieldType;
  options: DropdownOption[];
  show_on_card: boolean;
}

const EMPTY_NEW_FIELD: NewFieldState = {
  name: '',
  field_type: 'TEXT',
  options: [],
  show_on_card: false,
};

const BoardCustomFieldsPanel = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const { fields, loading, error, refetch } = useCustomFields(boardId);

  // New field form visibility + state.
  const [showForm, setShowForm] = useState(false);
  const [newField, setNewField] = useState<NewFieldState>(EMPTY_NEW_FIELD);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Inline rename: only one field can be renamed at a time.
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Which field's dropdown options editor is expanded.
  const [expandedOptionsId, setExpandedOptionsId] = useState<string | null>(null);

  // Per-field operation in-progress flag (keyed by field id).
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const setFieldBusy = (id: string, busy: boolean) =>
    setBusyIds((prev) => {
      const next = new Set(prev);
      busy ? next.add(id) : next.delete(id);
      return next;
    });

  // ─── Create ──────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!boardId || !newField.name.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      await createCustomField({
        api: apiClient,
        boardId,
        payload: {
          name: newField.name.trim(),
          field_type: newField.field_type,
          ...(newField.field_type === 'DROPDOWN' && { options: newField.options }),
          show_on_card: newField.show_on_card,
        },
      });
      setNewField(EMPTY_NEW_FIELD);
      setShowForm(false);
      refetch();
    } catch (err: unknown) {
      setCreateError((err as Error)?.message ?? 'Failed to create field');
    } finally {
      setCreating(false);
    }
  };

  // ─── Rename ───────────────────────────────────────────────────────────────

  const startRename = (field: CustomField) => {
    setRenamingId(field.id);
    setRenameValue(field.name);
  };

  const commitRename = async (field: CustomField) => {
    if (!boardId || !renameValue.trim() || renameValue.trim() === field.name) {
      setRenamingId(null);
      return;
    }
    setFieldBusy(field.id, true);
    try {
      await updateCustomField({
        api: apiClient,
        boardId,
        fieldId: field.id,
        payload: { name: renameValue.trim() },
      });
      refetch();
    } finally {
      setFieldBusy(field.id, false);
      setRenamingId(null);
    }
  };

  // ─── Toggle show_on_card ─────────────────────────────────────────────────

  const handleToggleShowOnCard = async (field: CustomField) => {
    if (!boardId) return;
    setFieldBusy(field.id, true);
    try {
      await updateCustomField({
        api: apiClient,
        boardId,
        fieldId: field.id,
        payload: { show_on_card: !field.show_on_card },
      });
      refetch();
    } finally {
      setFieldBusy(field.id, false);
    }
  };

  // ─── Dropdown options update ─────────────────────────────────────────────

  const handleOptionsChange = async (field: CustomField, options: DropdownOption[]) => {
    if (!boardId) return;
    setFieldBusy(field.id, true);
    try {
      await updateCustomField({
        api: apiClient,
        boardId,
        fieldId: field.id,
        payload: { options },
      });
      refetch();
    } finally {
      setFieldBusy(field.id, false);
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────────────

  const handleDelete = async (field: CustomField) => {
    if (!boardId) return;
    if (!window.confirm(translations['CustomFields.deleteConfirm'].replace('{fieldName}', field.name))) return;
    setFieldBusy(field.id, true);
    try {
      await deleteCustomField({ api: apiClient, boardId, fieldId: field.id });
      refetch();
    } finally {
      setFieldBusy(field.id, false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3" aria-label={translations['CustomFields.ariaOpenPanel']}>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{translations['CustomFields.panelTitle']}</p>

      {loading && <p className="text-xs text-slate-500">{translations['CustomFields.loading']}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Existing fields list */}
      {!loading && fields.length === 0 && (
        <p className="text-xs text-slate-500 italic">{translations['CustomFields.noFields']}.</p>
      )}

      {fields.map((field) => {
        const busy = busyIds.has(field.id);
        const isRenaming = renamingId === field.id;

        return (
          <div
            key={field.id}
            className="bg-slate-800 rounded p-2 space-y-1"
            aria-label={`Custom field ${field.name}`}
          >
            {/* Name row */}
            <div className="flex items-center gap-2">
              {isRenaming ? (
                <input
                  type="text"
                  value={renameValue}
                  autoFocus
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(field)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(field);
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  className="flex-1 bg-slate-700 border border-blue-500 rounded px-2 py-0.5 text-sm text-slate-200 focus:outline-none"
                  aria-label={translations['CustomFields.renameFieldAriaLabel']}
                />
              ) : (
                <button
                  type="button"
                  className="flex-1 text-left text-sm text-slate-200 hover:text-white truncate"
                  onClick={() => startRename(field)}
                  aria-label={`Rename field ${field.name}`}
                  disabled={busy}
                >
                  {field.name}
                </button>
              )}

              <span className="text-xs text-slate-500 flex-shrink-0">
                {FIELD_TYPE_LABELS[field.field_type]}
              </span>

              {/* Delete */}
              <button
                type="button"
                onClick={() => handleDelete(field)}
                disabled={busy}
                className="text-slate-500 hover:text-red-400 transition-colors text-xs"
                aria-label={`Delete field ${field.name}`}
              >
                ✕
              </button>
            </div>

            {/* Show on card toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={field.show_on_card}
                onChange={() => handleToggleShowOnCard(field)}
                disabled={busy}
                className="accent-blue-500"
                aria-label={translations['CustomFields.showOnCardLabel']}
              />
              <span className="text-xs text-slate-400">{translations['CustomFields.showOnCardLabel']}</span>
            </label>

            {/* Dropdown options editor toggle */}
            {field.field_type === 'DROPDOWN' && (
              <div>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedOptionsId(expandedOptionsId === field.id ? null : field.id)
                  }
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  aria-label={`Edit options for ${field.name}`}
                >
                  {expandedOptionsId === field.id ? translations['CustomFields.hideOptions'] : translations['CustomFields.editOptions']}
                </button>

                {expandedOptionsId === field.id && (
                  <div className="mt-2">
                    <DropdownFieldEditor
                      options={field.options ?? []}
                      onChange={(opts) => handleOptionsChange(field, opts)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add field form */}
      {showForm ? (
        <div className="bg-slate-800 rounded p-3 space-y-2" aria-label={translations['CustomFields.newFieldFormLabel']}>
          {/* Name */}
          <input
            type="text"
            value={newField.name}
            onChange={(e) => setNewField((f) => ({ ...f, name: e.target.value }))}
            placeholder={translations['CustomFields.fieldNamePlaceholder']}
            className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
            aria-label={translations['CustomFields.fieldNamePlaceholder']}
          />

          {/* Type selector */}
          <select
            value={newField.field_type}
            onChange={(e) =>
              setNewField((f) => ({ ...f, field_type: e.target.value as FieldType, options: [] }))
            }
            className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            aria-label={translations['CustomFields.typeLabel']}
          >
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {FIELD_TYPE_LABELS[t]}
              </option>
            ))}
          </select>

          {/* Dropdown options editor */}
          {newField.field_type === 'DROPDOWN' && (
            <DropdownFieldEditor
              options={newField.options}
              onChange={(opts) => setNewField((f) => ({ ...f, options: opts }))}
            />
          )}

          {/* Show on card */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={newField.show_on_card}
              onChange={(e) => setNewField((f) => ({ ...f, show_on_card: e.target.checked }))}
              className="accent-blue-500"
              aria-label={translations['CustomFields.showOnCardLabel']}
            />
            <span className="text-xs text-slate-400">{translations['CustomFields.showOnCardLabel']}</span>
          </label>

          {createError && <p className="text-xs text-red-400">{createError}</p>}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !newField.name.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs rounded py-1 transition-colors"
              aria-label={translations['CustomFields.ariaCreateField']}
            >
              {creating ? translations['CustomFields.creatingButton'] : translations['CustomFields.createFieldButton']}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setNewField(EMPTY_NEW_FIELD); setCreateError(null); }}
              className="text-slate-400 hover:text-slate-200 text-xs px-2 transition-colors"
              aria-label={translations['CustomFields.cancelButton']}
            >
              {translations['CustomFields.cancelButton']}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="w-full text-left text-xs text-blue-400 hover:text-blue-300 transition-colors py-1"
          aria-label={translations['CustomFields.ariaCreateField']}
        >
          {translations['CustomFields.addFieldButton']}
        </button>
      )}
    </div>
  );
};

export default BoardCustomFieldsPanel;
