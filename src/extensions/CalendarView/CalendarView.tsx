// CalendarView — root component for the Calendar board view (Sprint 53).
// Renders the monthly calendar grid by default.
// Toolbar note: cards without a due_date are not displayed.
// Drag-to-reschedule: dropping a chip on a new day fires PATCH /cards/:id
// with the new due_date (optimistic update, reverts + toast on error).
import { useState, useCallback, useMemo } from 'react';
import CalendarMonthGrid from './CalendarMonthGrid';
import type { CalendarMode, CalendarViewProps } from './types';
import type { Card } from '../Card/api';
import { apiClient } from '~/common/api/client';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { boardSliceActions } from '../Board/slices/boardSlice';

// Re-export boardSliceActions so BoardPage can import from the canonical location.
// (The slice is at src/extensions/Board/containers/BoardPage/boardSlice.ts)

interface Props extends CalendarViewProps {
  addToast?: (message: string, variant?: 'error' | 'success' | 'conflict') => void;
}

/** Build a lookup map: "YYYY-MM-DD" → Card[] from a list of cards with due_date. */
function buildCardsByDay(cards: Card[]): Map<string, Card[]> {
  const map = new Map<string, Card[]>();
  for (const card of cards) {
    if (!card.due_date) continue;
    // Truncate to date portion only (handles ISO timestamps)
    const key = card.due_date.slice(0, 10);
    const existing = map.get(key) ?? [];
    map.set(key, [...existing, card]);
  }
  return map;
}

const CalendarView = ({ cards, lists, onCardClick, addToast }: Props) => {
  const dispatch = useAppDispatch();
  const api = apiClient;

  const now = new Date();
  const [mode] = useState<CalendarMode>('month'); // week mode added in next iteration
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  // Only cards with a due_date are shown
  const scheduledCards = useMemo(() => cards.filter((c) => !!c.due_date), [cards]);
  const cardsByDay = useMemo(() => buildCardsByDay(scheduledCards), [scheduledCards]);

  const handlePrev = useCallback(() => {
    setMonth((m) => {
      if (m === 0) { setYear((y) => y - 1); return 11; }
      return m - 1;
    });
  }, []);

  const handleNext = useCallback(() => {
    setMonth((m) => {
      if (m === 11) { setYear((y) => y + 1); return 0; }
      return m + 1;
    });
  }, []);

  // ── Drag-to-reschedule ────────────────────────────────────────────────────
  const handleCardDrop = useCallback(
    async (cardId: string, newDate: string) => {
      const card = cards.find((c) => c.id === cardId);
      if (!card || card.due_date?.slice(0, 10) === newDate) return;

      const prevDate = card.due_date;

      // Optimistic: update the card in Redux state
      dispatch(boardSliceActions.optimisticUpdateCardField({ cardId, field: 'due_date', value: newDate }));

      try {
        await api.patch(`/cards/${cardId}`, { due_date: newDate });
      } catch {
        // Revert on error
        dispatch(boardSliceActions.optimisticUpdateCardField({ cardId, field: 'due_date', value: prevDate }));
        addToast?.('Failed to update due date. Changes reverted.', 'error');
      }
    },
    [api, cards, dispatch, addToast],
  );

  const hasUnscheduled = cards.length > scheduledCards.length;

  return (
    <div className="flex flex-1 flex-col overflow-auto" data-testid="calendar-view">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-slate-700 px-4 py-2 text-sm text-slate-400">
        {/* Mode toggle — week view wired in the next iteration */}
        <div className="flex rounded border border-slate-700" role="group" aria-label="Calendar mode">
          <button
            className={`px-3 py-1 text-xs rounded-l ${mode === 'month' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            aria-pressed={mode === 'month'}
            data-testid="calendar-mode-month"
            disabled
          >
            Month
          </button>
          <button
            className={`px-3 py-1 text-xs rounded-r ${mode === 'week' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            aria-pressed={mode === 'week'}
            data-testid="calendar-mode-week"
            disabled
            title="Week view coming in the next iteration"
          >
            Week
          </button>
        </div>

        {/* Cards-without-due-date note (always shown) */}
        <span className="text-xs text-slate-500" data-testid="calendar-no-due-date-note">
          Cards without a due date are not shown.
          {hasUnscheduled && (
            <> ({cards.length - scheduledCards.length} hidden)</>
          )}
        </span>
      </div>

      {/* Grid */}
      {mode === 'month' && (
        <CalendarMonthGrid
          year={year}
          month={month}
          cardsByDay={cardsByDay}
          onPrev={handlePrev}
          onNext={handleNext}
          onCardClick={onCardClick}
          onCardDrop={handleCardDrop}
        />
      )}
    </div>
  );
};

export default CalendarView;
