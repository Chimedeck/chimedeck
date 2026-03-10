// useCalendarDrag — drag-to-reschedule hook for the Calendar view (Sprint 53).
// Encapsulates the PATCH /api/v1/cards/:id call, optimistic Redux update,
// and error-revert + toast behaviour so both month and week grids share the logic.
import { useCallback } from 'react';
import { apiClient } from '~/common/api/client';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { boardSliceActions } from '../Board/slices/boardSlice';
import type { Card } from '../Card/api';

interface UseCalendarDragOptions {
  cards: Card[];
  addToast?: ((message: string, variant?: 'error' | 'success' | 'conflict') => void) | undefined;
}

interface UseCalendarDragResult {
  /** Call when a card chip is dropped on a day cell with a new ISO date string ("YYYY-MM-DD"). */
  handleCardDrop: (cardId: string, newDate: string) => Promise<void>;
}

export function useCalendarDrag({ cards, addToast }: UseCalendarDragOptions): UseCalendarDragResult {
  const dispatch = useAppDispatch();
  const api = apiClient;

  const handleCardDrop = useCallback(
    async (cardId: string, newDate: string) => {
      const card = cards.find((c) => c.id === cardId);
      if (!card || card.due_date?.slice(0, 10) === newDate) return;

      const prevDate = card.due_date;

      // Optimistic: move the card immediately in Redux
      dispatch(boardSliceActions.optimisticUpdateCardField({ cardId, field: 'due_date', value: newDate }));

      try {
        await api.patch(`/cards/${cardId}`, { due_date: newDate });
      } catch {
        // Revert on API error
        dispatch(boardSliceActions.optimisticUpdateCardField({ cardId, field: 'due_date', value: prevDate }));
        addToast?.('Failed to update due date. Changes reverted.', 'error');
      }
    },
    [api, cards, dispatch, addToast],
  );

  return { handleCardDrop };
}
