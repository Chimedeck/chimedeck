// Automation reducers — local state helpers for optimistic UI updates.
// Enable/disable and delete work optimistically: UI updates immediately, API call runs
// in the background; on failure the update is rolled back.
import { useState, useCallback } from 'react';
import type { Automation } from './types';
import { updateAutomation, deleteAutomation } from './api';

// useOptimisticAutomations wraps a list of automations and exposes toggle / remove helpers
// that apply UI changes immediately and roll back on API error.
export function useOptimisticAutomations(
  initial: Automation[],
  onError?: (message: string) => void
) {
  const [automations, setAutomations] = useState<Automation[]>(initial);

  // Keep the list in sync with fresh data from the server (e.g., after reload).
  const setAll = useCallback((list: Automation[]) => setAutomations(list), []);

  const toggleEnabled = useCallback(
    async ({
      boardId,
      automationId,
    }: {
      boardId: string;
      automationId: string;
    }) => {
      // Optimistic update.
      setAutomations((prev) =>
        prev.map((a) =>
          a.id === automationId ? { ...a, isEnabled: !a.isEnabled } : a
        )
      );

      try {
        const target = automations.find((a) => a.id === automationId);
        if (!target) return;
        await updateAutomation({
          boardId,
          automationId,
          patch: { isEnabled: !target.isEnabled },
        });
      } catch {
        // Rollback: flip back.
        setAutomations((prev) =>
          prev.map((a) =>
            a.id === automationId ? { ...a, isEnabled: !a.isEnabled } : a
          )
        );
        onError?.('Failed to toggle automation. Please try again.');
      }
    },
    [automations, onError]
  );

  const remove = useCallback(
    async ({
      boardId,
      automationId,
    }: {
      boardId: string;
      automationId: string;
    }) => {
      const snapshot = automations.find((a) => a.id === automationId);

      // Optimistic removal.
      setAutomations((prev) => prev.filter((a) => a.id !== automationId));

      try {
        await deleteAutomation({ boardId, automationId });
      } catch {
        // Rollback: re-insert at original position.
        if (snapshot) {
          setAutomations((prev) => {
            // Re-insert at the position it was in originally, or at the end.
            return [...prev, snapshot];
          });
        }
        onError?.('Failed to delete automation. Please try again.');
      }
    },
    [automations, onError]
  );

  return { automations, setAll, toggleEnabled, remove };
}
