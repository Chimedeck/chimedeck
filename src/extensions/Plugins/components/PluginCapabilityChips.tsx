// PluginCapabilityChips — compact chip list for plugin capabilities.
import translations from '../translations/en.json';

interface Props {
  capabilities: string[];
}

const CAPABILITY_LABELS: Record<string, string> = {
  'card-badges': translations['plugins.capabilities.cardBadges'],
  'card-buttons': translations['plugins.capabilities.cardButtons'],
  'card-detail-badges': translations['plugins.capabilities.cardDetailBadges'],
  section: translations['plugins.capabilities.section'],
  'show-settings': translations['plugins.capabilities.showSettings'],
  'authorization-status': translations['plugins.capabilities.authorizationStatus'],
  'show-authorization': translations['plugins.capabilities.showAuthorization'],
};

const PluginCapabilityChips = ({ capabilities }: Props) => {
  if (!capabilities.length) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {capabilities.map((cap) => (
        <span
          key={cap}
          // [theme-exception] capability badge colors are intentional
          className="text-xs bg-bg-overlay text-subtle rounded px-2 py-0.5"
        >
          {CAPABILITY_LABELS[cap] ?? cap}
        </span>
      ))}
    </div>
  );
};

export default PluginCapabilityChips;
