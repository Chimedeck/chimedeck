// CustomFieldValueEditor — type-aware input for editing a custom field value on a card.
// Handles TEXT, NUMBER, DATE, CHECKBOX, and DROPDOWN field types.
// [why] Each field type needs a different input; this component encapsulates the
//       type-dispatch so callers only pass the field definition and current value.
import { useState, useEffect, useCallback } from 'react';
import translations from './translations/en.json';
import type { CustomField, CustomFieldValue, DropdownOption } from './types';
import { apiClient } from '~/common/api/client';
import { upsertCardFieldValue, deleteCardFieldValue } from './api';

interface Props {
  cardId: string;
  field: CustomField;
  value: CustomFieldValue | null;
  disabled?: boolean;
  onValueChange?: (updated: CustomFieldValue | null) => void;
}

// Derive a display string from a raw CustomFieldValue for a given field.
function resolvedDisplayValue(
  field: CustomField,
  value: CustomFieldValue | null,
): string {
  if (!value) return '';
  switch (field.field_type) {
    case 'TEXT':
      return value.value_text ?? '';
    case 'NUMBER':
      return value.value_number ?? '';
    case 'DATE':
      return value.value_date ? value.value_date.slice(0, 10) : '';
    case 'CHECKBOX':
      return value.value_checkbox !== null ? String(value.value_checkbox) : '';
    case 'DROPDOWN':
      return value.value_option_id ?? '';
    default:
      return '';
  }
}

const CustomFieldValueEditor = ({
  cardId,
  field,
  value,
  disabled = false,
  onValueChange,
}: Props) => {
  const [saving, setSaving] = useState(false);
  const api = apiClient;

  // Local draft for text/number/date to avoid re-fetching on every keystroke.
  const [draft, setDraft] = useState<string>(() => resolvedDisplayValue(field, value));

  // Sync draft when external value prop changes (e.g. initial load).
  useEffect(() => {
    setDraft(resolvedDisplayValue(field, value));
  }, [field, value]);

  const save = useCallback(
    async (payload: Parameters<typeof upsertCardFieldValue>[0]['payload']) => {
      setSaving(true);
      try {
        const res = await upsertCardFieldValue({
          api,
          cardId,
          fieldId: field.id,
          payload,
        });
        onValueChange?.(res.data);
      } catch {
        // silently ignore; future iterations can surface error state
      } finally {
        setSaving(false);
      }
    },
    [api, cardId, field.id, onValueChange],
  );

  const handleClear = useCallback(async () => {
    setSaving(true);
    try {
      await deleteCardFieldValue({ api, cardId, fieldId: field.id });
      onValueChange?.(null);
      setDraft('');
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }, [api, cardId, field.id, onValueChange]);

  const inputClass =
    'w-full bg-bg-overlay border border-border rounded-lg px-2 py-1.5 text-sm text-base focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50';

  if (field.field_type === 'TEXT') {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          className={inputClass}
          value={draft}
          placeholder={translations['CustomFieldValue.textPlaceholder']}
          disabled={disabled || saving}
          aria-label={`${field.name} value`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft !== resolvedDisplayValue(field, value)) {
              save({ value_text: draft || null });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
        />
        {value && !disabled && (
          <button
            type="button"
            className="text-xs text-muted hover:text-danger transition-colors flex-shrink-0"
            onClick={handleClear}
            aria-label={`Clear ${field.name}`}
          >
            ✕
          </button>
        )}
      </div>
    );
  }

  if (field.field_type === 'NUMBER') {
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          className={inputClass}
          value={draft}
          placeholder={translations['CustomFieldValue.numberPlaceholder']}
          disabled={disabled || saving}
          aria-label={`${field.name} value`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const num = parseFloat(draft);
            const current = value?.value_number ? parseFloat(value.value_number) : null;
            if (draft === '' && current !== null) {
              handleClear();
            } else if (!isNaN(num) && num !== current) {
              save({ value_number: num });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
        {value && !disabled && (
          <button
            type="button"
            className="text-xs text-muted hover:text-danger transition-colors flex-shrink-0"
            onClick={handleClear}
            aria-label={`Clear ${field.name}`}
          >
            ✕
          </button>
        )}
      </div>
    );
  }

  if (field.field_type === 'DATE') {
    return (
      <div className="space-y-1">
        <input
          type="date"
          className={`${inputClass} [color-scheme:dark]`}
          value={draft}
          disabled={disabled || saving}
          aria-label={`${field.name} value`}
          onChange={(e) => {
            setDraft(e.target.value);
            if (e.target.value) {
              save({ value_date: new Date(e.target.value).toISOString() });
            } else {
              handleClear();
            }
          }}
        />
        {value && !disabled && (
          <button
            type="button"
            className="text-xs text-muted hover:text-danger transition-colors"
            onClick={handleClear}
          >
            {translations['CustomFieldValue.clearDate']}
          </button>
        )}
      </div>
    );
  }

  if (field.field_type === 'CHECKBOX') {
    const checked = value?.value_checkbox ?? false;
    return (
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          className="w-4 h-4 rounded accent-indigo-500 cursor-pointer disabled:opacity-50"
          checked={checked}
          disabled={disabled || saving}
          aria-label={field.name}
          onChange={(e) => {
            save({ value_checkbox: e.target.checked });
          }}
        />
      </label>
    );
  }

  if (field.field_type === 'DROPDOWN') {
    const options: DropdownOption[] = field.options ?? [];
    const selectedId = value?.value_option_id ?? '';
    const selected = options.find((o) => o.id === selectedId);

    return (
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          {/* Colour swatch preview */}
          {selected && (
            <span
              className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: selected.color }}
              aria-hidden="true"
            />
          )}
          <select
            className={`${inputClass} ${selected ? 'pl-7' : ''}`}
            value={selectedId}
            disabled={disabled || saving}
            aria-label={`${field.name} value`}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '') {
                handleClear();
              } else {
                save({ value_option_id: val });
              }
            }}
          >
            <option value="">{translations['CustomFieldValue.dropdownNone']}</option>
            {options.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {value && !disabled && (
          <button
            type="button"
            className="text-xs text-muted hover:text-danger transition-colors flex-shrink-0"
            onClick={handleClear}
            aria-label={`Clear ${field.name}`}
          >
            ✕
          </button>
        )}
      </div>
    );
  }

  return null;
};

export default CustomFieldValueEditor;
