// PluginCapabilityChips — compact chip list for plugin capabilities.
interface Props {
  capabilities: string[];
}

const CAPABILITY_LABELS: Record<string, string> = {
  'card-badges': 'Card Badges',
  'card-buttons': 'Card Buttons',
  'card-detail-badges': 'Card Detail Badges',
  section: 'Section',
  'show-settings': 'Settings',
  'authorization-status': 'Auth Status',
  'show-authorization': 'Authorization',
};

const PluginCapabilityChips = ({ capabilities }: Props) => {
  if (!capabilities.length) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {capabilities.map((cap) => (
        <span
          key={cap}
          className="text-xs bg-slate-700 text-slate-300 rounded px-2 py-0.5"
        >
          {CAPABILITY_LABELS[cap] ?? cap}
        </span>
      ))}
    </div>
  );
};

export default PluginCapabilityChips;
