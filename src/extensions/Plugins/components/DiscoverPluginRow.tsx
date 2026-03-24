// DiscoverPluginRow — single row for a plugin available to enable on this board.
// Shows icon, name, description, and an Enable button with optimistic-update support.
import { PuzzlePieceIcon } from '@heroicons/react/24/outline';
import translations from '../translations/en.json';
import PluginCapabilityChips from './PluginCapabilityChips';
import type { Plugin } from '../api';

interface Props {
  plugin: Plugin;
  onEnable: (plugin: Plugin) => void;
  loading?: boolean;
}

const DiscoverPluginRow = ({ plugin, onEnable, loading = false }: Props) => {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800 border border-slate-700 hover:border-slate-600 transition-colors">
      {/* Icon */}
      <div className="flex-shrink-0 w-9 h-9 rounded-md bg-slate-700 flex items-center justify-center overflow-hidden">
        {plugin.iconUrl ? (
          <img
            src={plugin.iconUrl}
            alt={plugin.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              // [why] Replace broken icon image with fallback puzzle icon
              (e.currentTarget as HTMLImageElement).style.display = 'none';
              (e.currentTarget.nextSibling as HTMLElement | null)?.removeAttribute('style');
            }}
          />
        ) : null}
        <PuzzlePieceIcon
          className="h-5 w-5 text-slate-400"
          aria-hidden="true"
          style={plugin.iconUrl ? { display: 'none' } : undefined}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-slate-100 font-medium text-sm">{plugin.name}</span>
          {plugin.author && (
            <span className="text-slate-500 text-xs">
              {translations['plugins.card.by']} {plugin.author}
            </span>
          )}
        </div>
        {plugin.description && (
          <p className="text-slate-400 text-xs mt-0.5 line-clamp-2">{plugin.description}</p>
        )}
        <PluginCapabilityChips capabilities={plugin.capabilities ?? []} />
        {plugin.categories?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {plugin.categories.map((cat) => (
              <span
                key={cat}
                className="text-xs bg-blue-900/50 text-blue-300 rounded px-1.5 py-0.5"
              >
                {cat}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Enable button */}
      <div className="flex-shrink-0">
        <button
          onClick={() => onEnable(plugin)}
          disabled={loading}
          className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded px-3 py-1.5 transition-colors"
        >
          {loading ? translations['plugins.card.enabling'] : translations['plugins.card.enable']}
        </button>
      </div>
    </div>
  );
};

export default DiscoverPluginRow;
