// TriggerConfig — renders dynamic form fields for the selected trigger type.
// Reads configSchema from the TriggerType and renders appropriate inputs.
// Falls back to a text input for unknown field types.
import type { TriggerType } from '../../../types';
import { renderConfigField } from './configFieldRenderer';

interface Props {
  triggerType: TriggerType;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

const TriggerConfig = ({ triggerType, config, onChange }: Props) => {
  const schema = triggerType.configSchema as Record<string, { type: string; label: string; options?: { value: string; label: string }[]; required?: boolean }>;
  const fields = Object.entries(schema);

  if (fields.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-slate-700 bg-slate-800/50 p-3">
      {fields.map(([key, fieldDef]) =>
        renderConfigField({
          key,
          fieldDef,
          value: config[key],
          onChange: (val) => onChange({ ...config, [key]: val }),
        })
      )}
    </div>
  );
};

export default TriggerConfig;
