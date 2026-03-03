// Persists label chip expanded/collapsed state per board in localStorage.
import { useState, useCallback } from 'react';

const storageKey = (boardId: string) => `card-labels-expanded:${boardId}`;

export function useCardLabelExpanded(boardId: string): [boolean, () => void] {
  const [expanded, setExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem(storageKey(boardId)) === 'true';
    } catch {
      return false;
    }
  });

  const toggle = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey(boardId), String(next));
      } catch {
        // localStorage unavailable — still toggle in memory
      }
      return next;
    });
  }, [boardId]);

  return [expanded, toggle];
}
