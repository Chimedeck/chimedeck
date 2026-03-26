// PluginCard — single plugin row: icon, name, description, capabilities, enable/disable button.
// For active plugins (mode='disable') with 'show-settings' capability, also shows a gear icon
// that triggers the plugin's settings modal.
// When onEdit is provided (platform admins only), shows a pencil edit button.
import { PuzzlePieceIcon, PencilIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import Button from '../../../common/components/Button';
import translations from '../translations/en.json';
import PluginCapabilityChips from './PluginCapabilityChips';
import type { Plugin, BoardPlugin } from '../api';

interface EnableCardProps {
  plugin: Plugin;
  mode: 'enable';
  onEnable: (plugin: Plugin) => void;
  onEdit?: (plugin: Plugin) => void;
  loading?: boolean;
}

interface DisableCardProps {
  boardPlugin: BoardPlugin;
  mode: 'disable';
  onDisable: (boardPlugin: BoardPlugin) => void;
  onSettings?: (boardPlugin: BoardPlugin) => void;
  onEdit?: (plugin: Plugin) => void;
  loading?: boolean;
}

type Props = EnableCardProps | DisableCardProps;

const PluginCard = (props: Props) => {
  const plugin = props.mode === 'enable' ? props.plugin : props.boardPlugin.plugin;
  const loading = props.loading ?? false;

  const handleAction = () => {
    if (props.mode === 'enable') {
      props.onEnable(plugin);
    } else {
      props.onDisable(props.boardPlugin);
    }
  };

  const hasSettings =
    props.mode === 'disable' && plugin.capabilities?.includes('show-settings');

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-bg-surface border border-border hover:border-border transition-colors">
      {/* Icon */}
      <div className="flex-shrink-0 w-10 h-10 rounded-md bg-bg-overlay flex items-center justify-center overflow-hidden">
        {plugin.iconUrl ? (
          <img src={plugin.iconUrl} alt={plugin.name} className="w-full h-full object-cover" />
        ) : (
          <PuzzlePieceIcon className="h-5 w-5 text-muted" aria-hidden="true" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-base font-medium text-sm truncate">{plugin.name}</span>
          {plugin.author && (
            <span className="text-muted text-xs">{translations['plugins.card.by']} {plugin.author}</span>
          )}
        </div>
        {plugin.description && (
          <p className="text-muted text-xs mt-0.5 line-clamp-2">{plugin.description}</p>
        )}
        <PluginCapabilityChips capabilities={plugin.capabilities ?? []} />
        {plugin.categories?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {plugin.categories.map((cat) => (
              <span key={cat} className="text-xs bg-blue-900/50 text-blue-300 rounded px-1.5 py-0.5">
                {cat}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex items-center gap-2">
        {/* Edit pencil — platform admins only, always visible when onEdit provided */}
        {props.onEdit && (
          <button
            onClick={() => props.onEdit!(plugin)}
            title={translations['plugins.card.editTitle']}
            className="text-muted hover:text-subtle p-1 rounded transition-colors"
            aria-label={translations['plugins.card.editAriaLabel']}
          >
            <PencilIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        )}

        {/* Settings gear — only for active plugins with show-settings capability */}
        {hasSettings && props.mode === 'disable' && props.onSettings && (
          <button
            onClick={() => (props as DisableCardProps).onSettings?.((props as DisableCardProps).boardPlugin)}
            title={translations['plugins.card.settingsTitle']}
            className="text-muted hover:text-subtle p-1 rounded transition-colors"
            aria-label={translations['plugins.card.settingsAriaLabel']}
          >
            <Cog6ToothIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        )}

        {props.mode === 'enable' ? (
          <Button
            variant="primary"
            size="sm"
            onClick={handleAction}
            disabled={loading}
          >
            {loading ? translations['plugins.card.enabling'] : translations['plugins.card.enable']}
          </Button>
        ) : (
          <button
            onClick={handleAction}
            disabled={loading}
            className="text-xs bg-bg-sunken hover:bg-red-700 disabled:opacity-50 text-subtle hover:text-base rounded px-3 py-1.5 transition-colors"
          >
            {loading ? translations['plugins.card.disabling'] : translations['plugins.card.disable']}
          </button>
        )}
      </div>
    </div>
  );
};

export default PluginCard;

