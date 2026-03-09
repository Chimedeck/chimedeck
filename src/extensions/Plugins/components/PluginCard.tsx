// PluginCard — single plugin row: icon, name, description, capabilities, enable/disable button.
// For active plugins (mode='disable') with 'show-settings' capability, also shows a gear icon
// that triggers the plugin's settings modal.
// When onEdit is provided (platform admins only), shows a pencil edit button.
import { PuzzlePieceIcon, PencilIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
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
    <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800 border border-slate-700 hover:border-slate-600 transition-colors">
      {/* Icon */}
      <div className="flex-shrink-0 w-10 h-10 rounded-md bg-slate-700 flex items-center justify-center overflow-hidden">
        {plugin.iconUrl ? (
          <img src={plugin.iconUrl} alt={plugin.name} className="w-full h-full object-cover" />
        ) : (
          <PuzzlePieceIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-slate-100 font-medium text-sm truncate">{plugin.name}</span>
          {plugin.author && (
            <span className="text-slate-500 text-xs">by {plugin.author}</span>
          )}
        </div>
        {plugin.description && (
          <p className="text-slate-400 text-xs mt-0.5 line-clamp-2">{plugin.description}</p>
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
            title="Edit plugin"
            className="text-slate-400 hover:text-slate-200 p-1 rounded transition-colors"
            aria-label="Edit plugin"
          >
            <PencilIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        )}

        {/* Settings gear — only for active plugins with show-settings capability */}
        {hasSettings && props.mode === 'disable' && props.onSettings && (
          <button
            onClick={() => (props as DisableCardProps).onSettings?.((props as DisableCardProps).boardPlugin)}
            title="Plugin settings"
            className="text-slate-400 hover:text-slate-200 p-1 rounded transition-colors"
            aria-label="Open plugin settings"
          >
            <Cog6ToothIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        )}

        {props.mode === 'enable' ? (
          <button
            onClick={handleAction}
            disabled={loading}
            className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded px-3 py-1.5 transition-colors"
          >
            {loading ? 'Enabling…' : 'Enable'}
          </button>
        ) : (
          <button
            onClick={handleAction}
            disabled={loading}
            className="text-xs bg-slate-600 hover:bg-red-700 disabled:opacity-50 text-slate-200 hover:text-white rounded px-3 py-1.5 transition-colors"
          >
            {loading ? 'Disabling…' : 'Disable'}
          </button>
        )}
      </div>
    </div>
  );
};

export default PluginCard;

