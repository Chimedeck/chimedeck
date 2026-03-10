// Custom Fields feature types — mirrors the server DB schema and API response shapes.

export type FieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'CHECKBOX' | 'DROPDOWN';

export interface DropdownOption {
  id: string;
  label: string;
  color: string; // hex e.g. "#FF5733"
}

// A field definition scoped to a board.
export interface CustomField {
  id: string;
  board_id: string;
  name: string;
  field_type: FieldType;
  options: DropdownOption[] | null; // only populated for DROPDOWN fields
  show_on_card: boolean;
  position: number;
  created_at: string;
}

// A value stored for a specific (card, custom_field) pair.
export interface CustomFieldValue {
  id: string;
  card_id: string;
  custom_field_id: string;
  value_text: string | null;
  value_number: string | null; // decimal serialised as string
  value_date: string | null;   // ISO 8601 timestamp
  value_checkbox: boolean | null;
  value_option_id: string | null; // for DROPDOWN
}

// Normalised value shape returned in card includes.
export interface CardCustomFieldValueInclude {
  fieldId: string;
  fieldName: string;
  fieldType: FieldType;
  value: string | number | boolean | null;
}

// Payload shapes for creating / updating a field definition.
export interface CreateCustomFieldPayload {
  name: string;
  field_type: FieldType;
  options?: DropdownOption[] | undefined;
  show_on_card?: boolean | undefined;
  position?: number | undefined;
}

export interface UpdateCustomFieldPayload {
  name?: string | undefined;
  options?: DropdownOption[] | undefined;
  show_on_card?: boolean | undefined;
  position?: number | undefined;
}

// Payload shape for upserting a card field value.
export interface UpsertCardFieldValuePayload {
  value_text?: string | null | undefined;
  value_number?: number | null | undefined;
  value_date?: string | null | undefined;
  value_checkbox?: boolean | null | undefined;
  value_option_id?: string | null | undefined;
}
