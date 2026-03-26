// src/extensions/Board/components/BoardSearchBar.tsx
// Board-scoped inline search bar.
// - Debounces input (300 ms) before firing API requests.
// - Suppresses requests when query < 2 characters (min-char guard).
// - Escape key clears the input and closes the results panel.
// - Shows a "no results" panel when the query is valid but returns empty.
// - Highlights matched text in result titles.
// - Accepts initialQuery to restore from URL on mount.
// - Resets state when boardId changes (board switch).
import { useState, useEffect, useRef } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { DocumentTextIcon, Bars3Icon } from '@heroicons/react/24/outline';
import { searchBoard, type BoardSearchResult } from '~/extensions/Search/api';

const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;

interface Props {
  boardId: string;
  token: string;
  /** Pre-fill the search input (e.g. restored from URL param). */
  initialQuery?: string;
  /** Called whenever the active query string changes (for URL sync). */
  onQueryChange?: (query: string) => void;
  /** Called when the user clicks a result item */
  onSelectResult?: (result: BoardSearchResult) => void;
}

/** Renders a title string with the matching substring wrapped in a <mark>. */
const HighlightedTitle = ({ title, query }: { title: string; query: string }) => {
  if (!query) return <>{title}</>;
  const idx = title.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{title}</>;
  return (
    <>
      {title.slice(0, idx)}
      {/* [theme-exception] highlight uses yellow to mark matched search text */}
      <mark className="bg-yellow-200 text-inherit rounded-sm px-0.5">
        {title.slice(idx, idx + query.length)}
      </mark>
      {title.slice(idx + query.length)}
    </>
  );
};

const BoardSearchBar = ({ boardId, token, initialQuery = '', onQueryChange, onSelectResult }: Props) => {
  const [inputValue, setInputValue] = useState(initialQuery);
  const [results, setResults] = useState<BoardSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close panel when clicking outside the component
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // Reset search state when the user navigates to a different board
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setInputValue('');
    setResults([]);
    setError(null);
    setLoading(false);
    setPanelOpen(false);
  // Only reset on boardId change; initialQuery is intentionally excluded here
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  // Notify parent whenever the committed search query changes (for URL sync)
  useEffect(() => {
    onQueryChange?.(inputValue.trim());
  }, [inputValue, onQueryChange]);

  const doSearch = async (q: string) => {
    if (q.length < MIN_CHARS) {
      setResults([]);
      setError(null);
      setLoading(false);
      setPanelOpen(q.length > 0); // keep panel open to show "min chars" hint
      return;
    }
    setLoading(true);
    setError(null);
    setPanelOpen(true);
    try {
      const res = await searchBoard({ boardId, q, token });
      setResults(res.data);
    } catch (err: unknown) {
      const e = err as { code?: string; name?: string };
      setError(e?.code ?? e?.name ?? 'search-failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim() === '') {
      setResults([]);
      setError(null);
      setLoading(false);
      setPanelOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      doSearch(value.trim()).catch(() => {});
    }, DEBOUNCE_MS);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      clearSearch();
    }
  };

  const clearSearch = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setInputValue('');
    setResults([]);
    setError(null);
    setLoading(false);
    setPanelOpen(false);
    inputRef.current?.focus();
  };

  const handleSelect = (result: BoardSearchResult) => {
    setPanelOpen(false);
    onSelectResult?.(result);
  };

  const showPanel = panelOpen && inputValue.trim().length > 0;
  const isBelowMinChars = inputValue.trim().length > 0 && inputValue.trim().length < MIN_CHARS;

  return (
    <div ref={containerRef} className="relative">
      {/* Search input */}
      <div className="flex items-center gap-1.5 rounded-md bg-bg-surface border border-transparent focus-within:border-blue-500 focus-within:bg-bg-base px-2 py-1 transition-colors w-56">
        <MagnifyingGlassIcon
          className="h-4 w-4 flex-shrink-0 text-muted"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          role="searchbox"
          aria-label="Search cards and lists on this board"
          aria-controls="board-search-panel"
          aria-expanded={showPanel}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (inputValue.trim().length >= MIN_CHARS) setPanelOpen(true);
          }}
          placeholder="Search a card name or description..."
          className="min-w-0 flex-1 bg-transparent text-sm text-subtle placeholder:text-subtle focus:outline-none"
        />
        {inputValue && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={clearSearch}
            className="flex-shrink-0 rounded text-muted hover:text-subtle focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <XMarkIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Results panel */}
      {showPanel && (
        <div
          id="board-search-panel"
          role="listbox"
          aria-label="Board search results"
          className="absolute left-0 top-full mt-1 z-30 w-80 rounded-md border border-border bg-bg-surface shadow-xl py-1 max-h-72 overflow-y-auto"
        >
          {isBelowMinChars ? (
            <p className="px-3 py-2 text-xs text-muted">
              Type at least {MIN_CHARS} characters to search.
            </p>
          ) : loading ? (
            <p className="px-3 py-2 text-xs text-muted" aria-live="polite">
              Searching…
            </p>
          ) : error ? (
            <p className="px-3 py-2 text-xs text-danger" role="alert">
              Search failed. Please try again.
            </p>
          ) : results.length === 0 ? (
            <p
              className="px-3 py-2 text-xs text-muted"
              data-testid="board-search-no-results"
            >
              No results for <span className="font-medium text-subtle">"{inputValue.trim()}"</span>
            </p>
          ) : (
            results.map((result) => (
              <button
                key={`${result.type}-${result.id}`}
                role="option"
                aria-selected={false}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-bg-overlay focus:bg-bg-overlay focus:outline-none"
                onClick={() => handleSelect(result)}
              >
                <span
                  className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-white ${ // [theme-exception] text-white on colored bg chip (indigo/emerald)
                    result.type === 'list' ? 'bg-indigo-500' : 'bg-emerald-500'
                  }`}
                  aria-hidden="true"
                >
                  {result.type === 'list'
                    ? <Bars3Icon className="h-3 w-3" />
                    : <DocumentTextIcon className="h-3 w-3" />}
                </span>
                <span className="truncate text-subtle">
                  <HighlightedTitle title={result.title} query={inputValue.trim()} />
                </span>
                <span className="ml-auto flex-shrink-0 text-xs text-muted capitalize">
                  {result.type}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default BoardSearchBar;
