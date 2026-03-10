// CustomFieldBadge — compact inline badge shown on card tiles for a single
// custom field value when show_on_card is true.
// [why] Keeps field-value display logic in one place; callers just pass the
//       type + normalised value and the badge handles formatting per type.
import type { FieldType, DropdownOption } from './types';

interface Props {
  fieldName: string;
  fieldType: FieldType;
  // Normalised display value (already resolved from the raw CustomFieldValue).
  value: string | number | boolean | null;
  // Option metadata for DROPDOWN fields — used to render the colour swatch.
  dropdownOption?: DropdownOption | null;
}

function formatValue(fieldType: FieldType, value: string | number | boolean | null): string {
  if (value === null || value === undefined || value === '') return '';
  switch (fieldType) {
    case 'CHECKBOX':
      return value ? '✓' : '✗';
    case 'DATE': {
      const d = new Date(value as string);
      return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
    }
    case 'NUMBER':
      return String(value);
    case 'TEXT':
      return String(value);
    case 'DROPDOWN':
      // caller passes option label as value for DROPDOWN
      return String(value);
    default:
      return String(value);
  }
}

const CustomFieldBadge = ({ fieldName, fieldType, value, dropdownOption }: Props) => {
  const formatted = formatValue(fieldType, value);
  if (!formatted) return null;

  const isCheckbox = fieldType === 'CHECKBOX';
  const isChecked = isCheckbox && !!value;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium max-w-[10rem] truncate ${
        isCheckbox
          ? isChecked
            ? 'bg-emerald-900/40 border border-emerald-700/40 text-emerald-400'
            : 'bg-slate-800 border border-slate-700 text-slate-500'
          : 'bg-slate-800 border border-slate-700 text-slate-300'
      }`}
      title={`${fieldName}: ${formatted}`}
      aria-label={`${fieldName}: ${formatted}`}
    >
      {dropdownOption && (
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: dropdownOption.color }}
          aria-hidden="true"
        />
      )}
      <span className="truncate">{formatted}</span>
    </span>
  );
};

export default CustomFieldBadge;
