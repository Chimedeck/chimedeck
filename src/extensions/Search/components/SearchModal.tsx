// src/extensions/Search/components/SearchModal.tsx
// Command-palette style search modal — opens on Cmd+K / Ctrl+K.
// Results are grouped by type (Boards / Cards).
import React, { useEffect, useCallback } from 'react';
import { useSearch } from '../hooks/useSearch';
import SearchInput from './SearchInput';
import SearchResultItem from './SearchResultItem';
import type { SearchResult } from '../api';

interface SearchModalProps {
  workspaceId: string;
  token: string;
  isOpen: boolean;
  onClose: () => void;
  /** Called when the user clicks a result — parent handles navigation */
  onSelect: (result: SearchResult) => void;
}

const SearchModal: React.FC<SearchModalProps> = ({
  workspaceId,
  token,
  isOpen,
  onClose,
  onSelect,
}) => {
  const { query, setQuery, results, loading, error } = useSearch({ workspaceId, token });

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const boards = results.filter((r) => r.type === 'board');
  const cards = results.filter((r) => r.type === 'card');
  const hasResults = results.length > 0;
  const tooShort = query.length > 0 && query.length < 2;

  const handleSelect = (result: SearchResult) => {
    onSelect(result);
    onClose();
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      {/* Panel — stop click from bubbling to backdrop */}
      <div
        className="w-full max-w-xl rounded-xl bg-bg-base shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border p-4">
          <SearchInput value={query} onChange={setQuery} autoFocus />
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {tooShort && (
            <p className="px-3 py-2 text-sm text-muted">
              Type at least 2 characters to search.
            </p>
          )}

          {!tooShort && query.length >= 2 && loading && (
            <p className="px-3 py-2 text-sm text-muted">Searching…</p>
          )}

          {!loading && error && (
            <p className="px-3 py-2 text-sm text-danger">Search failed. Please try again.</p>
          )}

          {!loading && !error && query.length >= 2 && !hasResults && (
            <p className="px-3 py-2 text-sm text-muted">No results found.</p>
          )}

          {!loading && boards.length > 0 && (
            <section>
              <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Boards
              </p>
              {boards.map((r) => (
                <SearchResultItem key={r.id} result={r} onSelect={handleSelect} />
              ))}
            </section>
          )}

          {!loading && cards.length > 0 && (
            <section>
              <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Cards
              </p>
              {cards.map((r) => (
                <SearchResultItem key={r.id} result={r} onSelect={handleSelect} />
              ))}
            </section>
          )}
        </div>

        <div className="border-t border-border px-4 py-2 text-right text-xs text-muted">
          Press <kbd className="rounded bg-bg-surface px-1">Esc</kbd> to close
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
