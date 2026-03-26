// TriggerConfig — renders dynamic form fields for the selected trigger type.
// Reads configSchema (JSON Schema from z.toJSONSchema) from the TriggerType and
// renders appropriate inputs via renderConfigField.
import { useEffect, useState } from 'react';
import type { TriggerType } from '../../../types';
import { renderConfigField, parseConfigSchema } from './configFieldRenderer';
import { apiClient } from '~/common/api/client';

interface Props {
  triggerType: TriggerType;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  boardId: string;
}

const TriggerConfig = ({ triggerType, config, onChange, boardId }: Props) => {
  const [boardLists, setBoardLists] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    apiClient
      .get(`/boards/${boardId}/lists`)
      .then((res: any) => setBoardLists(res.data ?? []))
      .catch(() => {});
  }, [boardId]);

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
