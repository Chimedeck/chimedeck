// ActionPicker — dropdown that lists all available action types from the API.
// Searchable; clicking a type calls onSelect(actionType).
import { useEffect, useState } from 'react';
import { PlayIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import type { ActionType } from '../../../types';
import { getActionTypes } from '../../../api';
import translations from '../../../translations/en.json';

interface Props {
  onSelect: (type: ActionType) => void;
  onCancel: () => void;
}

const ActionPicker = ({ onSelect, onCancel }: Props) => {
  const [actionTypes, setActionTypes] = useState<ActionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    getActionTypes()
      .then((res) => setActionTypes(res.data))
      .catch(() => setError(translations['automation.actionPicker.error.loadFailed']))
      .finally(() => setLoading(false));
  }, []);

  const filtered = query
    ? actionTypes.filter(
        (a) =>
          a.label.toLowerCase().includes(query.toLowerCase()) ||
          a.category.toLowerCase().includes(query.toLowerCase())
      )
    : actionTypes;

  // Group by category for easier browsing.
  const grouped = filtered.reduce<Record<string, ActionType[]>>((acc, a) => {
    const cat = a.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(a);
    return acc;
  }, {});

  return (
    <div className="rounded-md border border-border bg-bg-surface shadow-xl">
      {/* Search */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        <input
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none"
          placeholder={translations['automation.actionPicker.searchPlaceholder']}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {loading && (
        <p className="px-3 py-4 text-center text-sm text-muted">{translations['automation.actionPicker.loading']}</p>
      )}
      {error && (
        <p className="px-3 py-4 text-center text-sm text-danger">{error}</p>
      )}

      {!loading && !error && (
        <ul className="max-h-64 overflow-y-auto py-1" role="listbox">
          {Object.entries(grouped).map(([category, types]) => (
            <li key={category}>
              <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
                {category}
              </p>
              {types.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-bg-overlay"
                  onClick={() => onSelect(t)}
                >
                  <PlayIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  {t.label}
                </button>
              ))}
            </li>
          ))}
          {Object.keys(grouped).length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-muted">{translations['automation.actionPicker.noResults']}</li>
          )}
        </ul>
      )}

      <div className="border-t border-border px-3 py-2">
        <button
          type="button"
          className="text-xs text-muted hover:text-foreground transition-colors"
          onClick={onCancel}
        >
          {translations['automation.actionPicker.cancel']}
        </button>
      </div>
    </div>
  );
};

export default ActionPicker;
