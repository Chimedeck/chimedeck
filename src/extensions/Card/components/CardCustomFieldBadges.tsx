// CardCustomFieldBadges — renders inline custom field value badges on card tiles.
// Only shows fields with show_on_card=true that have a non-null value.
// [why] Kept separate from CardItem to avoid adding hooks to a memoized component
//       unnecessarily; if boardId is absent the component tree is skipped entirely.
import { useCustomFields, useCardCustomFieldValues } from '../../CustomFields/api';
import CustomFieldBadge from '../../CustomFields/CustomFieldBadge';
import type { CustomField } from '../../CustomFields/types';
import type { CustomFieldValue } from '../../CustomFields/types';

interface Props {
  cardId: string;
  boardId: string;
}

function hasNonNullValue(v: CustomFieldValue): boolean {
  return (
    v.value_text !== null ||
    v.value_number !== null ||
    v.value_date !== null ||
    v.value_checkbox !== null ||
    v.value_option_id !== null
  );
}

function resolveDisplayValue(
  field: CustomField,
  v: CustomFieldValue,
): string | number | boolean | null {
  switch (field.field_type) {
    case 'TEXT':
      return v.value_text;
    case 'NUMBER':
      return v.value_number !== null ? parseFloat(v.value_number) : null;
    case 'DATE':
      return v.value_date;
    case 'CHECKBOX':
      return v.value_checkbox;
    case 'DROPDOWN': {
      const opt = field.options?.find((o) => o.id === v.value_option_id);
      return opt ? opt.label : null;
    }
    default:
      return null;
  }
}

const CardCustomFieldBadges = ({ cardId, boardId }: Props) => {
  const { fields } = useCustomFields(boardId);
  const { values } = useCardCustomFieldValues(cardId);

  const badgeFields = fields.filter(
    (f) =>
      f.show_on_card &&
      values.some((v) => v.custom_field_id === f.id && hasNonNullValue(v)),
  );

  if (badgeFields.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {badgeFields.map((field) => {
        const val = values.find((v) => v.custom_field_id === field.id);
        if (!val) return null;
        const displayValue = resolveDisplayValue(field, val);
        const dropdownOption =
          field.field_type === 'DROPDOWN' && field.options
            ? field.options.find((o) => o.id === val.value_option_id) ?? null
            : null;
        return (
          <CustomFieldBadge
            key={field.id}
            fieldName={field.name}
            fieldType={field.field_type}
            value={displayValue}
            dropdownOption={dropdownOption}
          />
        );
      })}
    </div>
  );
};

export default CardCustomFieldBadges;
