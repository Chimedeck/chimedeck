// TriggerConfig — renders dynamic form fields for the selected trigger type.
// Reads configSchema (JSON Schema from z.toJSONSchema) from the TriggerType and
// renders appropriate inputs via renderConfigField.
import { useEffect, useState } from 'react';
import type { TriggerType } from '../../../types';
import { renderConfigField, parseConfigSchema } from './configFieldRenderer';
import { apiClient } from '~/common/api/client';
import translations from '../../../translations/en.json';

interface Props {
  triggerType: TriggerType;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  boardId: string;
}

type CustomFieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'CHECKBOX' | 'DROPDOWN';

interface CustomFieldOption {
  id: string;
  label: string;
  color?: string;
}

interface CustomFieldDef {
  id: string;
  name: string;
  field_type: CustomFieldType;
  options: CustomFieldOption[] | null;
}

const CUSTOM_FIELD_VALUE_UPDATED_TRIGGER = 'card.custom_field_value_updated';

function toOptions(raw: unknown): CustomFieldOption[] {
  if (Array.isArray(raw)) {
    return raw.filter((opt) => !!opt && typeof opt === 'object') as CustomFieldOption[];
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((opt) => !!opt && typeof opt === 'object') as CustomFieldOption[];
      }
    } catch {
      return [];
    }
  }

  return [];
}

const TriggerConfig = ({ triggerType, config, onChange, boardId }: Props) => {
  const [boardLists, setBoardLists] = useState<{ id: string; title: string }[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([]);

  useEffect(() => {
    apiClient
      .get(`/boards/${boardId}/lists`)
      .then((res: any) => setBoardLists(res.data ?? []))
      .catch(() => {});
  }, [boardId]);

  useEffect(() => {
    apiClient
      .get(`/boards/${boardId}/custom-fields`)
      .then((res: any) => {
        const rows = (res?.data ?? []) as Array<Record<string, unknown>>;
        setCustomFields(
          rows
            .filter((row) => typeof row.id === 'string' && typeof row.name === 'string' && typeof row.field_type === 'string')
            .map((row) => ({
              id: row.id as string,
              name: row.name as string,
              field_type: row.field_type as CustomFieldType,
              options: toOptions(row.options),
            }))
        );
      })
      .catch(() => setCustomFields([]));
  }, [boardId]);

  if (triggerType.type === CUSTOM_FIELD_VALUE_UPDATED_TRIGGER) {
    const selectedFieldId = typeof config.fieldId === 'string' ? config.fieldId : '';
    const selectedField = customFields.find((field) => field.id === selectedFieldId) ?? null;

    const setField = (fieldId: string) => {
      const field = customFields.find((item) => item.id === fieldId) ?? null;
      if (!field) {
        onChange({});
        return;
      }

      if (field.field_type === 'TEXT') {
        onChange({ fieldId: field.id, fieldType: field.field_type, valueText: '' });
        return;
      }

      if (field.field_type === 'NUMBER') {
        onChange({ fieldId: field.id, fieldType: field.field_type, valueNumber: 0 });
        return;
      }

      if (field.field_type === 'DATE') {
        onChange({ fieldId: field.id, fieldType: field.field_type, valueDate: '' });
        return;
      }

      if (field.field_type === 'CHECKBOX') {
        onChange({ fieldId: field.id, fieldType: field.field_type, valueCheckbox: false });
        return;
      }

      const firstOptionId = field.options?.[0]?.id ?? '';
      onChange({ fieldId: field.id, fieldType: field.field_type, valueOptionId: firstOptionId });
    };

    const setValue = (valuePatch: Record<string, unknown>) => {
      if (!selectedField) return;
      onChange({ fieldId: selectedField.id, fieldType: selectedField.field_type, ...valuePatch });
    };

    return (
      <div className="flex flex-col gap-3 rounded-md border border-border bg-bg-surface/50 p-3">
        <div>
          <label htmlFor="cfg-fieldId" className="mb-1 block text-xs font-medium text-muted">
            {translations['automation.triggerConfig.customField.fieldLabel']}
          </label>
          <select
            id="cfg-fieldId"
            className="w-full rounded-md border border-border bg-bg-overlay px-3 py-1.5 text-sm text-base focus:outline-none focus:ring-2 focus:ring-primary"
            value={selectedFieldId}
            onChange={(e) => setField(e.target.value)}
          >
            <option value="">{translations['automation.triggerConfig.customField.selectFieldPlaceholder']}</option>
            {customFields.map((field) => (
              <option key={field.id} value={field.id}>
                {field.name}
              </option>
            ))}
          </select>
        </div>

        {customFields.length === 0 && (
          <p className="text-xs text-muted italic">{translations['automation.triggerConfig.customField.noFields']}</p>
        )}

        {selectedField && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              {translations['automation.triggerConfig.customField.valueLabel']}
            </label>

            {selectedField.field_type === 'TEXT' && (
              <input
                type="text"
                className="w-full rounded-md border border-border bg-bg-overlay px-3 py-1.5 text-sm text-base placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={translations['automation.triggerConfig.customField.textPlaceholder']}
                value={typeof config.valueText === 'string' ? config.valueText : ''}
                onChange={(e) => setValue({ valueText: e.target.value })}
              />
            )}

            {selectedField.field_type === 'NUMBER' && (
              <input
                type="number"
                className="w-full rounded-md border border-border bg-bg-overlay px-3 py-1.5 text-sm text-base placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={translations['automation.triggerConfig.customField.numberPlaceholder']}
                value={typeof config.valueNumber === 'number' ? String(config.valueNumber) : ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  setValue({ valueNumber: raw === '' ? undefined : Number(raw) });
                }}
              />
            )}

            {selectedField.field_type === 'DATE' && (
              <input
                type="date"
                className="w-full rounded-md border border-border bg-bg-overlay px-3 py-1.5 text-sm text-base focus:outline-none focus:ring-2 focus:ring-primary"
                value={typeof config.valueDate === 'string' ? config.valueDate.slice(0, 10) : ''}
                onChange={(e) => setValue({ valueDate: e.target.value })}
              />
            )}

            {selectedField.field_type === 'CHECKBOX' && (
              <select
                className="w-full rounded-md border border-border bg-bg-overlay px-3 py-1.5 text-sm text-base focus:outline-none focus:ring-2 focus:ring-primary"
                value={typeof config.valueCheckbox === 'boolean' ? String(config.valueCheckbox) : ''}
                onChange={(e) => setValue({ valueCheckbox: e.target.value === 'true' })}
              >
                <option value="false">{translations['automation.triggerConfig.customField.checkboxFalse']}</option>
                <option value="true">{translations['automation.triggerConfig.customField.checkboxTrue']}</option>
              </select>
            )}

            {selectedField.field_type === 'DROPDOWN' && (
              <select
                className="w-full rounded-md border border-border bg-bg-overlay px-3 py-1.5 text-sm text-base focus:outline-none focus:ring-2 focus:ring-primary"
                value={typeof config.valueOptionId === 'string' ? config.valueOptionId : ''}
                onChange={(e) => setValue({ valueOptionId: e.target.value })}
              >
                <option value="">{translations['automation.triggerConfig.customField.selectOptionPlaceholder']}</option>
                {(selectedField.options ?? []).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>
    );
  }

  const fields = parseConfigSchema(triggerType.configSchema);

  if (fields.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-bg-surface/50 p-3">
      {fields.map(({ key, fieldDef }) =>
        renderConfigField({
          key,
          fieldDef,
          value: config[key],
          onChange: (val) => onChange({ ...config, [key]: val }),
          boardLists,
        })
      )}
    </div>
  );
};

export default TriggerConfig;
