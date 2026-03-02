// src/extensions/Search/hooks/useSearch.ts
// Debounced search hook — fetches results 300 ms after the user stops typing.
import { useState, useEffect, useCallback } from 'react';
import { searchWorkspace, type SearchResult } from '../api';

interface UseSearchOptions {
  workspaceId: string;
  token: string;
}

interface UseSearchResult {
  query: string;
  setQuery: (q: string) => void;
  results: SearchResult[];
  loading: boolean;
  error: string | null;
}

const DEBOUNCE_MS = 300;

export function useSearch({ workspaceId, token }: UseSearchOptions): UseSearchResult {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doSearch = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults([]);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await searchWorkspace({ workspaceId, q, token });
        setResults(res.data);
      } catch (err: unknown) {
        const e = err as { name?: string };
        setError(e?.name ?? 'search-failed');
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [workspaceId, token],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      doSearch(query).catch(() => {});
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  return { query, setQuery, results, loading, error };
}
