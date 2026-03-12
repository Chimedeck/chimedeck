// TriggerPicker — searchable dropdown that lists all trigger types fetched from the API.
// Selection calls onSelect(triggerType).
import { useEffect, useState } from 'react';
import { BoltSlashIcon, BoltIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import type { TriggerType } from '../../../types';
import { getTriggerTypes } from '../../../api';

interface Props {
  selectedType: string | null;
  onSelect: (type: TriggerType) => void;
}

const TriggerPicker = ({ selectedType, onSelect }: Props) => {
  const [triggerTypes, setTriggerTypes] = useState<TriggerType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getTriggerTypes()
      .then((res) => setTriggerTypes(res.data))
      .catch(() => setError('Failed to load trigger types.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = query
    ? triggerTypes.filter((t) => t.label.toLowerCase().includes(query.toLowerCase()))
    : triggerTypes;

  const selected = triggerTypes.find((t) => t.type === selectedType);

  return (
    <div className="relative">
      <label className="mb-1 block text-xs font-medium text-slate-400 uppercase tracking-wide">
        When…
      </label>

      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:border-slate-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (
          <>
            <BoltIcon className="h-4 w-4 shrink-0 text-blue-400" aria-hidden="true" />
            <span className="flex-1 truncate text-left">{selected.label}</span>
          </>
        ) : (
          <>
            <BoltSlashIcon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            <span className="flex-1 text-left text-slate-400">Select a trigger…</span>
          </>
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-slate-600 bg-slate-800 shadow-xl">
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-slate-700 px-3 py-2">
            <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <input
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
              placeholder="Search triggers…"
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

          {!loading && !error && filtered.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-slate-400">No results</p>
          )}

          {!loading && !error && filtered.length > 0 && (
            <ul className="max-h-56 overflow-y-auto py-1" role="listbox">
              {filtered.map((t) => (
                <li key={t.type} role="option" aria-selected={t.type === selectedType}>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-slate-700 ${
                      t.type === selectedType ? 'bg-slate-700 text-blue-400' : 'text-slate-200'
                    }`}
                    onClick={() => {
                      onSelect(t);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    <BoltIcon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    {t.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default TriggerPicker;
