// PluginAllowedDomainsPanel — board admin UI to restrict which of the plugin's
// whitelistedDomains are permitted on this board.
//
// - Shows a checkbox per domain in plugin.whitelistedDomains
// - Initial checked state: all domains if config.allowedDomains is null/undefined,
//   or the saved subset if it is an array.
// - "Save domain settings" is disabled while pristine (no changes from saved state).
// - On save, PATCHes /boards/:boardId/plugins/:pluginId/allowed-domains.

import { useState, useCallback, useMemo } from 'react';
import { apiClient } from '~/common/api/client';
import { pluginsConfig } from '../config/pluginsConfig';
import translations from '../translations/en.json';
import type { BoardPlugin } from '../api';

interface Props {
  boardPlugin: BoardPlugin;
  boardId: string;
}

const PluginAllowedDomainsPanel = ({ boardPlugin, boardId }: Props) => {
  const whitelistedDomains = boardPlugin.plugin.whitelistedDomains ?? [];
  const savedAllowedDomains = boardPlugin.config?.allowedDomains ?? null;

  // null → all whitelistedDomains are permitted; array → only those in the array
  const initialSelected = useMemo<string[]>(
    () => (savedAllowedDomains === null ? [...whitelistedDomains] : savedAllowedDomains),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boardPlugin.id],
  );

  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Pristine when the set of checked domains matches the last saved state
  const isPristine = useMemo(() => {
    if (selected.length !== initialSelected.length) return false;
    return initialSelected.every((d) => selected.includes(d));
  }, [selected, initialSelected]);

  const toggleDomain = useCallback((domain: string) => {
    setSelected((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain],
    );
    setSaveSuccess(false);
    setSaveError(null);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await apiClient.patch(
        `${pluginsConfig.boardPluginsPath(boardId)}/${boardPlugin.plugin.id}/allowed-domains`,
        { allowedDomains: selected },
      );
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : translations['plugins.allowedDomains.saveError']);
    } finally {
      setSaving(false);
    }
  }, [boardId, boardPlugin.plugin.id, selected]);

  if (whitelistedDomains.length === 0) return null;

  return (
    <div className="border-t border-border bg-bg-sunken px-4 py-3 flex-shrink-0">
      <h3 className="text-subtle text-xs font-semibold uppercase tracking-wide mb-2">
        {translations['plugins.allowedDomains.heading']}
      </h3>
      <p className="text-subtle text-xs mb-3">
        {translations['plugins.allowedDomains.description']}
      </p>

      <ul className="space-y-1.5 mb-3">
        {whitelistedDomains.map((domain) => (
          <li key={domain} className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`allowed-domain-${domain}`}
              checked={selected.includes(domain)}
              onChange={() => toggleDomain(domain)}
              className="w-3.5 h-3.5 accent-blue-500 cursor-pointer"
            />
            <label
              htmlFor={`allowed-domain-${domain}`}
              className="text-subtle text-xs font-mono cursor-pointer select-none"
            >
              {domain}
            </label>
          </li>
        ))}
      </ul>

      {saveError && (
        <p className="text-danger text-xs mb-2" role="alert">
          {saveError}
        </p>
      )}
      {saveSuccess && (
        <p className="text-success text-xs mb-2" role="status">
          {translations['plugins.allowedDomains.saveSuccess']}
        </p>
      )}

      <button
        onClick={() => void handleSave()}
        disabled={isPristine || saving}
        className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded px-3 py-1.5 transition-colors" // [theme-exception] text-white on bg-blue-600 save button
      >
        {saving ? translations['plugins.allowedDomains.saving'] : translations['plugins.allowedDomains.save']}
      </button>
    </div>
  );
};

export default PluginAllowedDomainsPanel;
