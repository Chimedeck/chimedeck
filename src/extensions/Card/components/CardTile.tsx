// CardTile — compact card representation rendered inside a ListColumn.
import type { Card } from '../api';
import type { CustomField } from '../../CustomFields/types';
import type { CustomFieldValue } from '../../CustomFields/types';
import CustomFieldBadge from '../../CustomFields/CustomFieldBadge';

interface Props {
  card: Card;
  onClick: (cardId: string) => void;
  dragHandleProps?: Record<string, unknown>;
  style?: React.CSSProperties;
  // Optional: custom field definitions for the board (only show_on_card=true ones)
  customFields?: CustomField[];
  // Optional: current field values for this card
  customFieldValues?: CustomFieldValue[];
}

const CardTile = ({
  card,
  onClick,
  dragHandleProps = {},
  style,
  customFields = [],
  customFieldValues = [],
}: Props) => {
  // Fields configured to show on card tiles with values present.
  const badgeFields = customFields.filter(
    (f) =>
      f.show_on_card &&
      customFieldValues.some((v) => v.custom_field_id === f.id && hasNonNullValue(v)),
  );

  return (
    <div
      className={`group rounded bg-bg-surface px-3 py-2 shadow-sm cursor-pointer hover:bg-blue-50 transition-colors${card.archived ? ' opacity-60' : ''}`}
      style={style}
      onClick={() => onClick(card.id)}
      role="button"
      tabIndex={0}
      aria-label={`Card: ${card.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick(card.id);
      }}
      {...dragHandleProps}
    >
      {card.archived && (
        <span className="mb-1 inline-block rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-700">
          Archived
        </span>
      )}
      <p className="text-sm font-medium text-base break-words">{card.title}</p>
      {card.due_date && (
        <p className="mt-1 text-xs text-muted">
          Due: {new Date(card.due_date).toLocaleDateString()}
        </p>
      )}
      {badgeFields.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {badgeFields.map((field) => {
            const val = customFieldValues.find((v) => v.custom_field_id === field.id);
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
      )}
    </div>
  );
};

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

export default CardTile;
