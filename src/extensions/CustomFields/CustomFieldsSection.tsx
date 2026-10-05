// CustomFieldsSection — renders all board-level custom fields for a card,
// with inline value editing. Placed inside the card modal main column.
// [why] Self-contained so no changes are needed to the parent Redux container;
//       the section manages its own field + value state via hooks.
import { useCallback, useEffect, useRef, useState } from 'react';
import translations from './translations/en.json';
import {
  useCustomFields,
  useCardCustomFieldValues,
  invalidateBoardCardFieldValuesCache,
} from './api';
import CustomFieldValueEditor from './CustomFieldValueEditor';
import type { CustomFieldValue } from './types';

interface Props {
  boardId: string;
  cardId: string;
  disabled?: boolean;
}

const CustomFieldsSection = ({ boardId, cardId, disabled = false }: Props) => {
  const { fields, loading: fieldsLoading } = useCustomFields(boardId);
  const { values, loading: valuesLoading, setValues } = useCardCustomFieldValues(cardId);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [columnCount, setColumnCount] = useState(1);

  useEffect(() => {
    if (!gridRef.current) return undefined;

    const resolveColumns = (width: number): 1 | 2 | 3 => {
      if (width >= 640) return 3;
      if (width >= 360) return 2;
      return 1;
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const nextColumns = resolveColumns(entry.contentRect.width);
      setColumnCount((prev) => (prev === nextColumns ? prev : nextColumns));
    });

    observer.observe(gridRef.current);
    return () => {
      observer.disconnect();
    };
  }, [fieldsLoading, valuesLoading, fields.length]);

  const handleValueChange = useCallback(
    (fieldId: string, updated: CustomFieldValue | null) => {
      let nextValues: CustomFieldValue[];
      if (updated) {
        // Replace existing entry or add new one.
        const hasExisting = values.some((v) => v.custom_field_id === fieldId);
        nextValues = hasExisting
          ? values.map((v) => (v.custom_field_id === fieldId ? updated : v))
          : [...values, updated];
      } else {
        nextValues = values.filter((v) => v.custom_field_id !== fieldId);
      }

      setValues(nextValues);
      invalidateBoardCardFieldValuesCache(boardId);
    },
    [boardId, values, setValues]
  );

  if (fieldsLoading || valuesLoading) {
    return (
      <div className="text-xs text-muted animate-pulse py-2">
        {translations['CustomFields.loadingCustomFields']}
      </div>
    );
  }

  if (fields.length === 0) return null;

  return (
    <section aria-label={translations['CustomFields.sectionLabel']}>
      <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
        {translations['CustomFields.panelTitle']}
      </h3>
      <div
        ref={gridRef}
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${String(columnCount)}, minmax(0, 1fr))` }}
      >
        {fields.map((field) => {
          const value = values.find((v) => v.custom_field_id === field.id) ?? null;
          return (
            <div key={field.id} className="min-w-0">
              <label className="mb-1 block text-xs text-subtle">{field.name}</label>
              <CustomFieldValueEditor
                cardId={cardId}
                field={field}
                value={value}
                disabled={disabled}
                onValueChange={(updated) => {
                  handleValueChange(field.id, updated);
                }}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
};

// Re-export so consumers can also access badge values for tile rendering.
export {
  useCustomFields,
  useCardCustomFieldValues,
  upsertCardFieldValue,
  deleteCardFieldValue,
} from './api';
export { apiClient } from '~/common/api/client';
export default CustomFieldsSection;
