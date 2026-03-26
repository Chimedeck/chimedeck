// src/common/components/CommandPalette.tsx
// Command-palette style search modal with scope tabs (All / Boards / Cards).
// Opens on Cmd+K / Ctrl+K. Scope persists in sessionStorage so it survives
// palette close/reopen within the same browser session.
import React, { useEffect, useCallback, useRef, useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useSearch } from '~/extensions/Search/hooks/useSearch';
import SearchResultItem from '~/extensions/Search/components/SearchResultItem';
import type { SearchResult } from '~/extensions/Search/api';
import translations from '~/common/translations/en.json';

// --------------------------------------------------------------------------
// Types & constants
// --------------------------------------------------------------------------

type Scope = 'all' | 'board' | 'card';

const SCOPE_SESSION_KEY = 'command-palette-scope';

interface ScopeMeta {
  value: Scope;
  label: string;
  placeholder: string;
  emptyText: string;
}

const SCOPES: ScopeMeta[] = [
  {
    value: 'all',
    label: translations['CommandPalette.allScopeLabel'],
    placeholder: translations['CommandPalette.allScopePlaceholder'],
    emptyText: translations['CommandPalette.allScopeEmpty'],
  },
  {
    value: 'board',
    label: translations['CommandPalette.boardScopeLabel'],
    placeholder: translations['CommandPalette.boardScopePlaceholder'],
    emptyText: translations['CommandPalette.boardScopeEmpty'],
  },
  {
    value: 'card',
    label: translations['CommandPalette.cardScopeLabel'],
    placeholder: translations['CommandPalette.cardScopePlaceholder'],
    emptyText: translations['CommandPalette.cardScopeEmpty'],
  },
];

function readScope(): Scope {
  try {
    const stored = sessionStorage.getItem(SCOPE_SESSION_KEY);
    if (stored === 'all' || stored === 'board' || stored === 'card') return stored;
  } catch {
    // sessionStorage unavailable — fall back to default
  }
  return 'all';
}

function writeScope(scope: Scope): void {
  try {
    sessionStorage.setItem(SCOPE_SESSION_KEY, scope);
  } catch {
    // ignore write errors
  }
}

// --------------------------------------------------------------------------
// Props
// --------------------------------------------------------------------------

export interface CommandPaletteProps {
  workspaceId: string;
  token: string;
  isOpen: boolean;
  onClose: () => void;
  /** Called when a result row is clicked — parent handles navigation */
  onSelect: (result: SearchResult) => void;
}

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

const CommandPalette: React.FC<CommandPaletteProps> = ({
  workspaceId,
  token,
  isOpen,
  onClose,
  onSelect,
}) => {
  // Scope state — initialise from sessionStorage on first render
  const [scope, setScopeState] = useState<Scope>(readScope);

  const changeScope = useCallback((next: Scope) => {
    writeScope(next);
    setScopeState(next);
  }, []);

  // Derive the API `type` param from scope
  const apiType: 'board' | 'card' | undefined =
    scope === 'board' ? 'board' : scope === 'card' ? 'card' : undefined;

  const searchOptions = {
    workspaceId,
    token,
    ...(apiType !== undefined ? { type: apiType } : {}),
  };

  const { query, setQuery, results, loading, error } = useSearch(searchOptions);

  // Keyboard focus tracking for result navigation
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const resultRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Refs for scope tab buttons (for keyboard navigation between tabs)
  const scopeTabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Build the flat list of results to display based on active scope
  const boards = results.filter((r) => r.type === 'board');
  const cards = results.filter((r) => r.type === 'card');

  // For "all" scope we show both sections; for a specific scope only that section
  const visibleResults: SearchResult[] =
    scope === 'all' ? results : scope === 'board' ? boards : cards;

  const hasResults = visibleResults.length > 0;
  const tooShort = query.length > 0 && query.length < 2;
  const scopeMeta = SCOPES.find((s) => s.value === scope)!;

  // Reset active index whenever results change
  useEffect(() => {
    setActiveIndex(-1);
  }, [results, scope]);

  // Focus active result button
  useEffect(() => {
    if (activeIndex >= 0 && resultRefs.current[activeIndex]) {
      resultRefs.current[activeIndex]?.focus();
    }
  }, [activeIndex]);

  // Global keydown handlers: Escape to close
  const handleGlobalKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleGlobalKeyDown);
    }
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, handleGlobalKeyDown]);

  // Re-focus input when palette opens and reset query
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(-1);
      // Small delay ensures the DOM is rendered before we try to focus
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen, setQuery]);

  if (!isOpen) return null;

  // --------------------------------------------------------------------------
  // Keyboard nav inside the search input
  // --------------------------------------------------------------------------

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (visibleResults.length > 0) setActiveIndex(0);
    }
  };

  // --------------------------------------------------------------------------
  // Keyboard nav on scope tabs
  // --------------------------------------------------------------------------

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (idx + 1) % SCOPES.length;
      scopeTabRefs.current[next]?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (idx - 1 + SCOPES.length) % SCOPES.length;
      scopeTabRefs.current[prev]?.focus();
    } else if (e.key === 'Tab' && !e.shiftKey && visibleResults.length > 0) {
      e.preventDefault();
      setActiveIndex(0);
    }
  };

  // --------------------------------------------------------------------------
  // Keyboard nav on result items
  // --------------------------------------------------------------------------

  const handleResultKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(idx + 1, visibleResults.length - 1);
      setActiveIndex(next);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx === 0) {
        // Wrap back to search input
        inputRef.current?.focus();
        setActiveIndex(-1);
      } else {
        setActiveIndex(idx - 1);
      }
    }
  };

  // --------------------------------------------------------------------------
  // Select handler
  // --------------------------------------------------------------------------

  const handleSelect = (result: SearchResult) => {
    onSelect(result);
    onClose();
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-20 sm:pt-24"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={translations['CommandPalette.ariaLabel']}
    >
      {/* Panel */}
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl bg-bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <MagnifyingGlassIcon className="h-5 w-5 flex-shrink-0 text-subtle" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={scopeMeta.placeholder}
            className="flex-1 bg-transparent text-sm text-base placeholder-subtle outline-none"
            aria-label={translations['CommandPalette.inputAriaLabel']}
          />
        </div>

        {/* Scope tabs */}
        <div
          className="flex gap-1 border-b border-border px-3 py-2"
          role="tablist"
          aria-label={translations['CommandPalette.scopeTabsAriaLabel']}
        >
          {SCOPES.map((s, idx) => (
            <button
              key={s.value}
              ref={(el) => { scopeTabRefs.current[idx] = el; }}
              role="tab"
              aria-selected={scope === s.value}
              onClick={() => changeScope(s.value)}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                scope === s.value
                  ? 'bg-primary text-inverse'
                  : 'text-muted hover:bg-bg-overlay'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Results */}
        <div
          className="max-h-80 overflow-y-auto p-2"
          role="tabpanel"
          aria-label={`${scopeMeta.label} results`}
        >
          {/* Too short */}
          {tooShort && (
            <p className="px-3 py-2 text-sm text-muted">
              {translations['CommandPalette.tooShort']}
            </p>
          )}

          {/* Loading */}
          {!tooShort && query.length >= 2 && loading && (
            <p className="px-3 py-2 text-sm text-muted">{translations['CommandPalette.searching']}</p>
          )}

          {/* Error */}
          {!loading && error && (
            <p className="px-3 py-2 text-sm text-danger">
              {translations['CommandPalette.error']}
            </p>
          )}

          {/* Empty state (scope-aware) */}
          {!loading && !error && query.length >= 2 && !hasResults && (
            <p className="px-3 py-2 text-sm text-muted">
              {scopeMeta.emptyText}
            </p>
          )}

          {/* Results — All scope shows grouped sections */}
          {!loading && !error && scope === 'all' && (
            <>
              {boards.length > 0 && (
                <section aria-label={translations['CommandPalette.boardsHeader']}>
                  <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-subtle">
                    {translations['CommandPalette.boardsHeader']}
                  </p>
                  {boards.map((r, globalIdx) => {
                    const flatIdx = globalIdx;
                    return (
                      <SearchResultItem
                        key={r.id}
                        result={r}
                        onSelect={handleSelect}
                        buttonRef={(el) => { resultRefs.current[flatIdx] = el; }}
                        onKeyDown={(e) => handleResultKeyDown(e, flatIdx)}
                      />
                    );
                  })}
                </section>
              )}
              {cards.length > 0 && (
                <section aria-label={translations['CommandPalette.cardsHeader']}>
                  <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-subtle">
                    {translations['CommandPalette.cardsHeader']}
                  </p>
                  {cards.map((r, i) => {
                    const flatIdx = boards.length + i;
                    return (
                      <SearchResultItem
                        key={r.id}
                        result={r}
                        onSelect={handleSelect}
                        buttonRef={(el) => { resultRefs.current[flatIdx] = el; }}
                        onKeyDown={(e) => handleResultKeyDown(e, flatIdx)}
                      />
                    );
                  })}
                </section>
              )}
            </>
          )}

          {/* Results — scoped (Boards or Cards) */}
          {!loading && !error && scope !== 'all' && visibleResults.length > 0 && (
            <section aria-label={scopeMeta.label}>
              {visibleResults.map((r, idx) => (
                <SearchResultItem
                  key={r.id}
                  result={r}
                  onSelect={handleSelect}
                  buttonRef={(el) => { resultRefs.current[idx] = el; }}
                  onKeyDown={(e) => handleResultKeyDown(e, idx)}
                />
              ))}
            </section>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-subtle">
          <span>
            <kbd className="rounded bg-bg-overlay px-1 text-muted">↑↓</kbd>
            {' '}{translations['CommandPalette.footerNavigate']}
            {' · '}
            <kbd className="rounded bg-bg-overlay px-1 text-muted">↵</kbd>
            {' '}{translations['CommandPalette.footerOpen']}
          </span>
          <span>
            {translations['CommandPalette.footerEscPrefix']} <kbd className="rounded bg-bg-overlay px-1 text-muted">Esc</kbd> {translations['CommandPalette.footerEscClose']}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
