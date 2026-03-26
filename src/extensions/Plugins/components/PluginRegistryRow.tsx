// PluginRegistryRow — single row in the platform admin Plugin Registry table.
// Shows icon (with fallback), name, author email, description, category chips,
// and action buttons: Edit, Deactivate (with inline confirm), Reactivate (inactive plugins).
import { useState } from 'react';
import { PuzzlePieceIcon, PencilIcon } from '@heroicons/react/24/outline';
import translations from '../translations/en.json';
import type { Plugin } from '../api';

// [why] Encapsulate icon-with-fallback so the main row stays clean.
const PluginIcon = ({ iconUrl, name }: { iconUrl: string; name: string }) => {
  const [broken, setBroken] = useState(false);
  if (broken) return <PuzzlePieceIcon className="h-5 w-5 text-subtle" aria-hidden="true" />;
  return (
    <img
      src={iconUrl}
      alt={name}
      className="w-full h-full object-cover"
      onError={() => setBroken(true)}
    />
  );
};

interface Props {
  plugin: Plugin;
  onEdit: (plugin: Plugin) => void;
  onDeactivate: (pluginId: string) => void;
  onReactivate: (pluginId: string) => void;
  isDeactivating?: boolean;
  isReactivating?: boolean;
}

const PluginRegistryRow = ({
  plugin,
  onEdit,
  onDeactivate,
  onReactivate,
  isDeactivating = false,
  isReactivating = false,
}: Props) => {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleDeactivateClick = () => setConfirmOpen(true);
  const handleConfirmYes = () => {
    setConfirmOpen(false);
    onDeactivate(plugin.id);
  };
  const handleConfirmNo = () => setConfirmOpen(false);

  return (
    <tr className="border-b border-border hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      {/* Icon */}
      <td className="px-4 py-3 w-12">
        <div className="flex-shrink-0 w-9 h-9 rounded-md bg-bg-overlay flex items-center justify-center overflow-hidden">
          {plugin.iconUrl ? (
            <PluginIcon iconUrl={plugin.iconUrl} name={plugin.name} />
          ) : (
            <PuzzlePieceIcon className="h-5 w-5 text-subtle" aria-hidden="true" />
          )}
        </div>
      </td>

      {/* Name + Author */}
      <td className="px-4 py-3 max-w-[180px]">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-base truncate">
            {plugin.name}
          </span>
          {!plugin.isActive && (
            <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 rounded px-1.5 py-0.5 whitespace-nowrap">
              {translations['plugins.registry.row.inactiveBadge']}
            </span>
          )}
        </div>
        {plugin.authorEmail && (
          <p className="text-xs text-subtle truncate mt-0.5">
            {plugin.authorEmail}
          </p>
        )}
      </td>

      {/* Description */}
      <td className="px-4 py-3 max-w-[240px]">
        <p className="text-sm text-muted line-clamp-2">
          {plugin.description}
        </p>
      </td>

      {/* Categories */}
      <td className="px-4 py-3">
        {plugin.categories?.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {plugin.categories.map((cat) => (
              <span
                key={cat}
                className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded px-1.5 py-0.5"
              >
                {cat}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-subtle">—</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3 whitespace-nowrap text-right">
        <div className="flex items-center justify-end gap-2">
          {/* Edit button */}
          <button
            type="button"
            onClick={() => onEdit(plugin)}
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-indigo-600 dark:hover:text-indigo-400 px-2 py-1 rounded border border-border hover:border-indigo-400 transition-colors"
            aria-label={`${translations['plugins.registry.row.edit']} ${plugin.name}`}
          >
            <PencilIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {translations['plugins.registry.row.edit']}
          </button>

          {/* Deactivate / Reactivate */}
          {plugin.isActive ? (
            confirmOpen ? (
              <span className="inline-flex items-center gap-1 text-xs">
                <span className="text-muted">
                  {translations['plugins.registry.row.confirmDeactivate']}
                </span>
                <button
                  type="button"
                  onClick={handleConfirmYes}
                  disabled={isDeactivating}
                  // [theme-exception]: text-white on bg-red-600 destructive confirm button
                  className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
                  aria-label="Confirm deactivate"
                >
                  {isDeactivating
                    ? translations['plugins.registry.row.deactivating']
                    : translations['plugins.registry.row.confirmYes']}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmNo}
                  className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-muted hover:bg-bg-overlay dark:hover:bg-slate-700 transition-colors"
                  aria-label="Cancel deactivate"
                >
                  {translations['plugins.registry.row.confirmNo']}
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleDeactivateClick}
                disabled={isDeactivating}
                className="text-xs text-danger hover:text-danger px-2 py-1 rounded border border-red-200 dark:border-red-800 hover:border-red-400 transition-colors disabled:opacity-50"
                aria-label={`${translations['plugins.registry.row.deactivate']} ${plugin.name}`}
              >
                {translations['plugins.registry.row.deactivate']}
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={() => onReactivate(plugin.id)}
              disabled={isReactivating}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 transition-colors disabled:opacity-50"
              aria-label={`${translations['plugins.registry.row.reactivate']} ${plugin.name}`}
            >
              {isReactivating
                ? translations['plugins.registry.row.reactivating']
                : translations['plugins.registry.row.reactivate']}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

export default PluginRegistryRow;
