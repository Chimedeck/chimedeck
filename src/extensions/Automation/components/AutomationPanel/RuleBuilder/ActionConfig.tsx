// ActionConfig — renders dynamic config form fields for a selected action type.
// Mirrors TriggerConfig but namespaced per-action so keys don't clash.
import type { ActionType } from '../../../types';
import { renderConfigField } from './configFieldRenderer';

interface Props {
  actionType: ActionType;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

const ActionConfig = ({ actionType, config, onChange }: Props) => {
  const schema = actionType.configSchema as Record<string, { type: string; label: string; options?: { value: string; label: string }[]; required?: boolean }>;
  const fields = Object.entries(schema);

  if (fields.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-3 rounded-md border border-slate-700 bg-slate-800/50 px-3 py-2">
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

export default ActionConfig;
