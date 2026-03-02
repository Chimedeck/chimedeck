// useListReorder — optimistic list reorder with rollback on failure.
// Manages the local order array and calls the reorder API, reverting on error.
import { useState, useCallback } from 'react';
import type { List } from '../api';
import { reorderLists } from '../api';

interface Options {
  api: { post: <T>(url: string, data: unknown) => Promise<T> };
  boardId: string;
}

export function useListReorder({ api, boardId }: Options) {
  const [lists, setLists] = useState<List[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Initialise / replace the list array (e.g., after a fresh fetch)
  const setInitialLists = useCallback((incoming: List[]) => {
    setLists(incoming);
  }, []);

  /**
   * Moves the list at `fromIndex` to `toIndex`, applies the change
   * optimistically, then syncs with the server.  Rolls back on failure.
   */
  const move = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;

      const prev = lists.slice();
      const next = lists.slice();
      const [item] = next.splice(fromIndex, 1);
      if (!item) return;
      next.splice(toIndex, 0, item);

      // Apply optimistically
      setLists(next);
      setError(null);

      try {
        const result = await reorderLists({
          api,
          boardId,
          order: next.map((l) => l.id),
        });
        // Replace with server-authoritative positions
        setLists(result.data);
      } catch {
        // Roll back on failure
        setLists(prev);
        setError('Failed to save list order. Please try again.');
      }
    },
    [lists, api, boardId],
  );

  return { lists, setInitialLists, move, error };
}
