// ActionPicker — dropdown that lists all available action types from the API.
// Searchable; clicking a type calls onSelect(actionType).
import { useEffect, useState } from 'react';
import { PlayIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import type { ActionType } from '../../../types';
import { getActionTypes } from '../../../api';

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
      .catch(() => setError('Failed to load action types.'))
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
    <div className="rounded-md border border-slate-600 bg-slate-800 shadow-xl">
      {/* Search */}
      <div className="flex items-center gap-2 border-b border-slate-700 px-3 py-2">
        <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <input
          className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
          placeholder="Search actions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {loading && (
        <p className="px-3 py-4 text-center text-sm text-slate-400">Loading…</p>
      )}
      {error && (
        <p className="px-3 py-4 text-center text-sm text-red-400">{error}</p>
      )}

      {!loading && !error && (
        <ul className="max-h-64 overflow-y-auto py-1" role="listbox">
          {Object.entries(grouped).map(([category, types]) => (
            <li key={category}>
              <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {category}
              </p>
              {types.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-700"
                  onClick={() => onSelect(t)}
                >
                  <PlayIcon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  {t.label}
                </button>
              ))}
            </li>
          ))}
          {Object.keys(grouped).length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-slate-400">No results</li>
          )}
        </ul>
      )}

      <div className="border-t border-slate-700 px-3 py-2">
        <button
          type="button"
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default ActionPicker;
