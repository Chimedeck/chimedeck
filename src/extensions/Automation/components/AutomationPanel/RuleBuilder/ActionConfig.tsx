// ActionConfig — renders dynamic config form fields for a selected action type.
// Mirrors TriggerConfig but namespaced per-action so keys don't clash.
import { useEffect, useState } from 'react';
import type { ActionType } from '../../../types';
import { renderConfigField, parseConfigSchema } from './configFieldRenderer';
import { apiClient } from '~/common/api/client';
import translations from '../../../translations/en.json';

interface Props {
  actionType: ActionType;
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

const UPDATE_CUSTOM_FIELD_ACTION = 'card.update_custom_field_value';

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

const ActionConfig = ({ actionType, config, onChange, boardId }: Props) => {
  const [boardLists, setBoardLists] = useState<{ id: string; title: string }[]>([]);
  const [workspaceBoards, setWorkspaceBoards] = useState<{ id: string; title: string }[]>([]);
  const [targetBoardLists, setTargetBoardLists] = useState<{ id: string; title: string }[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([]);

  useEffect(() => {
    apiClient
      .get(`/boards/${boardId}/lists`)
      .then((res: any) => setBoardLists(res.data ?? []))
      .catch(() => {});
  }, [boardId]);

  // Fetch the other boards in the same workspace — needed for board-select fields.
  useEffect(() => {
    apiClient
      .get(`/boards/${boardId}/workspace/boards`)
      .then((res: any) => setWorkspaceBoards(res.data ?? []))
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

  // Whenever the user picks a target board, fetch its lists for the target-list-select field.
  const selectedTargetBoardId = typeof config.targetBoardId === 'string' ? config.targetBoardId : null;
  useEffect(() => {
    if (!selectedTargetBoardId) {
      setTargetBoardLists([]);
      return;
    }
    apiClient
      .get(`/boards/${selectedTargetBoardId}/lists`)
      .then((res: any) => setTargetBoardLists(res.data ?? []))
      .catch(() => setTargetBoardLists([]));
  }, [selectedTargetBoardId]);

  if (actionType.type === UPDATE_CUSTOM_FIELD_ACTION) {
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
      <div className="mt-2 flex flex-col gap-3 rounded-md border border-border bg-bg-surface/50 px-3 py-2">
        <div>
          <label htmlFor="cfg-action-fieldId" className="mb-1 block text-xs font-medium text-muted">
            {translations['automation.actionConfig.customField.fieldLabel']}
          </label>
          <select
            id="cfg-action-fieldId"
            className="w-full rounded-md border border-border bg-bg-overlay px-3 py-1.5 text-sm text-base focus:outline-none focus:ring-2 focus:ring-primary"
            value={selectedFieldId}
            onChange={(e) => setField(e.target.value)}
          >
            <option value="">{translations['automation.actionConfig.customField.selectFieldPlaceholder']}</option>
            {customFields.map((field) => (
              <option key={field.id} value={field.id}>
                {field.name}
              </option>
            ))}
          </select>
        </div>

        {customFields.length === 0 && (
          <p className="text-xs text-muted italic">{translations['automation.actionConfig.customField.noFields']}</p>
        )}

        {selectedField && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              {translations['automation.actionConfig.customField.valueLabel']}
            </label>

            {selectedField.field_type === 'TEXT' && (
              <input
                type="text"
                className="w-full rounded-md border border-border bg-bg-overlay px-3 py-1.5 text-sm text-base placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={translations['automation.actionConfig.customField.textPlaceholder']}
                value={typeof config.valueText === 'string' ? config.valueText : ''}
                onChange={(e) => setValue({ valueText: e.target.value })}
              />
            )}

            {selectedField.field_type === 'NUMBER' && (
              <input
                type="number"
                className="w-full rounded-md border border-border bg-bg-overlay px-3 py-1.5 text-sm text-base placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={translations['automation.actionConfig.customField.numberPlaceholder']}
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
                <option value="false">{translations['automation.actionConfig.customField.checkboxFalse']}</option>
                <option value="true">{translations['automation.actionConfig.customField.checkboxTrue']}</option>
              </select>
            )}

            {selectedField.field_type === 'DROPDOWN' && (
              <select
                className="w-full rounded-md border border-border bg-bg-overlay px-3 py-1.5 text-sm text-base focus:outline-none focus:ring-2 focus:ring-primary"
                value={typeof config.valueOptionId === 'string' ? config.valueOptionId : ''}
                onChange={(e) => setValue({ valueOptionId: e.target.value })}
              >
                <option value="">{translations['automation.actionConfig.customField.selectOptionPlaceholder']}</option>
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

  const fields = parseConfigSchema(actionType.configSchema);

  if (fields.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-3 rounded-md border border-border bg-bg-surface/50 px-3 py-2">
      {fields.map(({ key, fieldDef }) =>
        renderConfigField({
          key,
          fieldDef,
          value: config[key],
          onChange: (val) => {
            const next = { ...config, [key]: val };
            // Clear the target list when the target board changes so stale data isn't saved.
            if (key === 'targetBoardId') {
              next.targetListId = undefined;
            }
            onChange(next);
          },
          boardLists,
          workspaceBoards,
          targetBoardLists,
        })
      )}
    </div>
  );
};

export default ActionConfig;
