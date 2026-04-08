// CustomFieldsSection — renders all board-level custom fields for a card,
// with inline value editing. Placed inside the card modal main column.
// [why] Self-contained so no changes are needed to the parent Redux container;
//       the section manages its own field + value state via hooks.
import { useCallback } from 'react';
import translations from './translations/en.json';
import { useCustomFields, useCardCustomFieldValues, invalidateBoardCardFieldValuesCache } from './api';
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
    [boardId, values, setValues],
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
      <div className="space-y-3">
        {fields.map((field) => {
          const value = values.find((v) => v.custom_field_id === field.id) ?? null;
          return (
            <div key={field.id} className="flex flex-col gap-1">
              <label className="text-xs text-subtle">{field.name}</label>
              <CustomFieldValueEditor
                cardId={cardId}
                field={field}
                value={value}
                disabled={disabled}
                onValueChange={(updated) => handleValueChange(field.id, updated)}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
};

// Re-export so consumers can also access badge values for tile rendering.
export { useCustomFields, useCardCustomFieldValues, upsertCardFieldValue, deleteCardFieldValue } from './api';
export { apiClient } from '~/common/api/client';
export default CustomFieldsSection;
