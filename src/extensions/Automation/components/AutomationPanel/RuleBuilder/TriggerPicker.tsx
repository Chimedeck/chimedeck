// TriggerPicker — searchable dropdown that lists all trigger types fetched from the API.
// Selection calls onSelect(triggerType).
import { useEffect, useState } from 'react';
import { BoltSlashIcon, BoltIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import type { TriggerType } from '../../../types';
import { getTriggerTypes } from '../../../api';
import translations from '../../../translations/en.json';

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
      .catch(() => setError(translations['automation.triggerPicker.error.loadFailed']))
      .finally(() => setLoading(false));
  }, []);

  const filtered = query
    ? triggerTypes.filter((t) => t.label.toLowerCase().includes(query.toLowerCase()))
    : triggerTypes;

  const selected = triggerTypes.find((t) => t.type === selectedType);

  return (
    <div className="relative">
      <label className="mb-1 block text-xs font-medium text-muted uppercase tracking-wide">
        {translations['automation.triggerPicker.label']}
      </label>

      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-foreground hover:border-border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <BoltSlashIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="flex-1 text-left text-muted">{translations['automation.triggerPicker.placeholder']}</span>
          </>
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-border bg-bg-surface shadow-xl">
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <input
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none"
              placeholder={translations['automation.triggerPicker.searchPlaceholder']}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>

          {loading && (
            <p className="px-3 py-4 text-center text-sm text-muted">{translations['automation.triggerPicker.loading']}</p>
          )}

          {error && (
            <p className="px-3 py-4 text-center text-sm text-danger">{error}</p>
          )}

          {!loading && !error && filtered.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-muted">{translations['automation.triggerPicker.noResults']}</p>
          )}

          {!loading && !error && filtered.length > 0 && (
            <ul className="max-h-56 overflow-y-auto py-1" role="listbox">
              {filtered.map((t) => (
                <li key={t.type} role="option" aria-selected={t.type === selectedType}>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-bg-overlay ${
                      t.type === selectedType ? 'bg-bg-overlay text-blue-400' : 'text-foreground'
                    }`}
                    onClick={() => {
                      onSelect(t);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    <BoltIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
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
