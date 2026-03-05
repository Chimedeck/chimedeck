// PluginCard — single plugin row: icon, name, description, capabilities, enable/disable button.
import PluginCapabilityChips from './PluginCapabilityChips';
import type { Plugin, BoardPlugin } from '../api';

interface EnableCardProps {
  plugin: Plugin;
  mode: 'enable';
  onEnable: (plugin: Plugin) => void;
  loading?: boolean;
}

interface DisableCardProps {
  boardPlugin: BoardPlugin;
  mode: 'disable';
  onDisable: (boardPlugin: BoardPlugin) => void;
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

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800 border border-slate-700 hover:border-slate-600 transition-colors">
      {/* Icon */}
      <div className="flex-shrink-0 w-10 h-10 rounded-md bg-slate-700 flex items-center justify-center overflow-hidden">
        {plugin.iconUrl ? (
          <img src={plugin.iconUrl} alt={plugin.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-slate-400 text-lg">🧩</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-slate-100 font-medium text-sm truncate">{plugin.name}</span>
          {plugin.authorName && (
            <span className="text-slate-500 text-xs">by {plugin.authorName}</span>
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

      {/* Action button */}
      <div className="flex-shrink-0">
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
