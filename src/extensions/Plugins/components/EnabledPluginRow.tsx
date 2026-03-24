// EnabledPluginRow — single row for a plugin enabled on this board.
// Shows icon, name/author, Settings button (if show-settings capability), and Disable button.
import { PuzzlePieceIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import translations from '../translations/en.json';
import type { BoardPlugin } from '../api';

interface Props {
  boardPlugin: BoardPlugin;
  onSettings?: (boardPlugin: BoardPlugin) => void;
  onDisable: (boardPlugin: BoardPlugin) => void;
  loading?: boolean;
}

const EnabledPluginRow = ({ boardPlugin, onSettings, onDisable, loading = false }: Props) => {
  const { plugin } = boardPlugin;
  const hasSettings = plugin.capabilities?.includes('show-settings') && onSettings;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800 border border-slate-700">
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

      {/* Name + author */}
      <div className="flex-1 min-w-0">
        <span className="text-slate-100 font-medium text-sm truncate block">{plugin.name}</span>
        {plugin.author && (
          <span className="text-slate-500 text-xs">
            {translations['plugins.card.by']} {plugin.author}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {hasSettings && (
          <button
            onClick={() => onSettings!(boardPlugin)}
            title={translations['plugins.card.settingsTitle']}
            aria-label={translations['plugins.card.settingsAriaLabel']}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded transition-colors"
          >
            <Cog6ToothIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <button
          onClick={() => onDisable(boardPlugin)}
          disabled={loading}
          className="text-xs bg-slate-600 hover:bg-red-700 disabled:opacity-50 text-slate-200 hover:text-white rounded px-3 py-1.5 transition-colors"
        >
          {loading ? translations['plugins.card.disabling'] : translations['plugins.card.disable']}
        </button>
      </div>
    </div>
  );
};

export default EnabledPluginRow;
