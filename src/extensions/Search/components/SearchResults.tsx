// src/extensions/Search/components/SearchResults.tsx
// Renders grouped workspace search results (Boards / Cards) with stale-result
// safety: when a board result is clicked and the server returns 403 or 404, the
// component shows a neutral message, purges the stale entry from the client
// cache, and redirects the user to the workspace boards list.
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '~/store';
import SearchResultItem from './SearchResultItem';
import { purgeInaccessibleResult } from '../slices/searchSlice';
import type { SearchResult } from '../api';

interface SearchResultsProps {
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  query: string;
  /** Current workspace — used to build the redirect URL on access failure */
  workspaceId: string;
  token: string;
  /** Called after successful navigation intent is confirmed */
  onSelect: (result: SearchResult) => void;
}

/**
 * Verifies that the caller still has read access to a board.
 * Returns true when accessible, false on 403/404.
 * Any other status (network error, 5xx) re-throws so callers can fall back.
 */
async function checkBoardAccess({
  boardId,
  token,
}: {
  boardId: string;
  token: string;
}): Promise<boolean> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/v1/boards/${boardId}`, { headers });

  if (res.status === 403 || res.status === 404) return false;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw err;
  }
  return true;
}

const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  loading,
  error,
  query,
  workspaceId,
  token,
  onSelect,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  // id of the board result whose access just failed — drives the stale banner
  const [staleBoardId, setStaleBoardId] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const handleSelect = useCallback(
    async (result: SearchResult) => {
      // Non-board results go through immediately — no extra check needed.
      if (result.type !== 'board') {
        onSelect(result);
        return;
      }

      setCheckingId(result.id);
      setStaleBoardId(null);

      try {
        const accessible = await checkBoardAccess({ boardId: result.id, token });

        if (!accessible) {
          // The board is no longer accessible — purge from local cache, show
          // a neutral message, and redirect to the workspace boards list after
          // a short moment so the user reads the message.
          dispatch(purgeInaccessibleResult({ id: result.id }));
          setStaleBoardId(result.id);

          setTimeout(() => {
            navigate(`/workspaces/${workspaceId}/boards`);
          }, 1800);
          return;
        }

        // Board is still accessible — proceed with normal navigation.
        onSelect(result);
      } catch {
        // On unexpected errors (network, 5xx) fall through to normal navigation
        // rather than blocking the user with a false-positive stale warning.
        onSelect(result);
      } finally {
        setCheckingId(null);
      }
    },
    [dispatch, navigate, onSelect, token, workspaceId],
  );

  const tooShort = query.length > 0 && query.length < 2;
  const boards = results.filter((r) => r.type === 'board');
  const cards = results.filter((r) => r.type === 'card');
  const hasResults = results.length > 0;

  return (
    <div className="max-h-96 overflow-y-auto p-2">
      {/* Stale-result banner — shown after a 403/404 on board click */}
      {staleBoardId !== null && (
        <div
          role="status"
          aria-live="polite"
          data-testid="stale-board-banner"
          className="mx-2 mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
        >
          This board is no longer accessible. Redirecting to your boards list…
        </div>
      )}

      {tooShort && (
        <p className="px-3 py-2 text-sm text-gray-500">
          Type at least 2 characters to search.
        </p>
      )}

      {!tooShort && query.length >= 2 && loading && (
        <p className="px-3 py-2 text-sm text-gray-500">Searching…</p>
      )}

      {!loading && error && (
        <p className="px-3 py-2 text-sm text-red-500">Search failed. Please try again.</p>
      )}

      {!loading && !error && query.length >= 2 && !hasResults && staleBoardId === null && (
        <p className="px-3 py-2 text-sm text-gray-500">No results found.</p>
      )}

      {!loading && boards.length > 0 && (
        <section>
          <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Boards
          </p>
          {boards.map((r) => (
            <div key={r.id} className="relative">
              <SearchResultItem
                result={r}
                onSelect={handleSelect}
              />
              {/* Subtle spinner while access check is in flight */}
              {checkingId === r.id && (
                <span
                  aria-hidden="true"
                  className="absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-500"
                />
              )}
            </div>
          ))}
        </section>
      )}

      {!loading && cards.length > 0 && (
        <section>
          <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Cards
          </p>
          {cards.map((r) => (
            <SearchResultItem key={r.id} result={r} onSelect={handleSelect} />
          ))}
        </section>
      )}
    </div>
  );
};

export default SearchResults;
