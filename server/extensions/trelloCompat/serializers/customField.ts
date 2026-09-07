import type {
  TrelloCustomField,
  TrelloCustomFieldItem,
  TrelloCustomFieldOption,
  TrelloCustomFieldType,
} from '../types/trello';
import { rankToPos } from './position';

type CustomFieldOptionRow = {
  id: string;
  value?: string | { text?: string } | null;
  color?: string | null;
  pos?: number | string | null;
};

type CustomFieldRow = {
  id: string;
  board_id: string;
  name: string;
  field_type: string;
  position?: number | string | null;
  _rank?: number;
  options?: CustomFieldOptionRow[] | string | null;
  show_on_card?: boolean | null;
};

type CardCustomFieldValueRow = {
  id: string;
  card_id: string;
  custom_field_id: string;
  value_text?: string | null;
  value_number?: number | string | null;
  value_date?: string | Date | null;
  value_checkbox?: boolean | null;
  value_option_id?: string | null;
};

function toCustomFieldType(rawType: string): TrelloCustomFieldType {
  const normalized = rawType.trim().toUpperCase();
  if (normalized === 'TEXT') return 'text';
  if (normalized === 'NUMBER') return 'number';
  if (normalized === 'DATE') return 'date';
  if (normalized === 'CHECKBOX') return 'checkbox';
  return 'list';
}

function toOptionText(value: CustomFieldOptionRow['value']): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof value.text === 'string') return value.text;
  return '';
}

function toIsoOrNull(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return !!value;
}

function toOptions(value: CustomFieldRow['options'], idCustomField: string): TrelloCustomFieldOption[] {
  let options: CustomFieldOptionRow[] = [];
  if (Array.isArray(value)) {
    options = value;
  } else if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) options = parsed as CustomFieldOptionRow[];
    } catch {
      options = [];
    }
  }

  return options.map((option, index) => ({
    id: option.id,
    idCustomField,
    value: { text: toOptionText(option.value) },
    color: option.color ?? null,
    pos: Number.isFinite(Number(option.pos)) ? Number(option.pos) : rankToPos(index),
  }));
}

function toValueForFieldType(
  row: CardCustomFieldValueRow,
  fieldType?: string,
): TrelloCustomFieldItem['value'] {
  const normalizedType = fieldType?.trim().toUpperCase();
  if (normalizedType === 'TEXT') return { text: row.value_text ?? null };
  if (normalizedType === 'NUMBER') {
    return { number: row.value_number === null || row.value_number === undefined ? null : String(row.value_number) };
  }
  if (normalizedType === 'DATE') {
    return { date: toIsoOrNull(row.value_date) };
  }
  if (normalizedType === 'CHECKBOX') {
    return { checked: row.value_checkbox === null || row.value_checkbox === undefined ? null : String(row.value_checkbox) };
  }
  if (normalizedType === 'DROPDOWN') return { optionId: row.value_option_id ?? null };

  if (row.value_option_id) return { optionId: row.value_option_id };
  if (row.value_date) return { date: toIsoOrNull(row.value_date) };
  if (row.value_number !== null && row.value_number !== undefined) return { number: String(row.value_number) };
  if (row.value_checkbox !== null && row.value_checkbox !== undefined) return { checked: String(row.value_checkbox) };
  return { text: row.value_text ?? null };
}

export function serializeCustomField(customField: CustomFieldRow): TrelloCustomField {
  const fieldType = toCustomFieldType(customField.field_type);
  const fallbackPos = typeof customField._rank === 'number' ? rankToPos(customField._rank) : 65535;
  const explicitPos = Number(customField.position);
  const pos = Number.isFinite(explicitPos) && explicitPos > 0 ? explicitPos : fallbackPos;

  return {
    id: customField.id,
    idModel: customField.board_id,
    modelType: 'board',
    fieldGroup: customField.id,
    display: { cardFront: toBoolean(customField.show_on_card) },
    name: customField.name,
    pos,
    type: fieldType,
    options: fieldType === 'list' ? toOptions(customField.options, customField.id) : [],
  };
}

export function serializeCustomFieldItem(
  row: CardCustomFieldValueRow,
  fieldType?: string,
): TrelloCustomFieldItem {
  const value = toValueForFieldType(row, fieldType);
  const result: TrelloCustomFieldItem = {
    id: row.id,
    idCustomField: row.custom_field_id,
    idModel: row.card_id,
    modelType: 'card',
    value,
  };

  if (value.optionId) result.idValue = value.optionId;
  return result;
}
